import {createHash,X509Certificate} from 'node:crypto';
import {open,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inflateRawSync} from 'node:zlib';

const EOCD_SIGNATURE=0x06054b50;
const CENTRAL_SIGNATURE=0x02014b50;
const LOCAL_SIGNATURE=0x04034b50;
const APK_SIG_MAGIC=Buffer.from('APK Sig Block 42','ascii');
const MAX_CENTRAL_DIRECTORY_BYTES=32*1024*1024;
const MAX_MANIFEST_BYTES=4*1024*1024;
const MAX_SIGNING_BLOCK_BYTES=16*1024*1024;
const NO_INDEX=0xffffffff;

export const DEFAULT_ANDROID_PACKAGE_NAME='ru.sportbuddy.mobile';

const fail=(message,code,status=409)=>{throw Object.assign(new Error(message),{code,status});};
const normalizeFingerprint=value=>String(value||'').replace(/[^a-fA-F0-9]/g,'').toLowerCase();

async function readExact(fd,position,length){
  if(!Number.isSafeInteger(position)||position<0||!Number.isSafeInteger(length)||length<0)fail('Некорректная структура APK.','APK_STRUCTURE_INVALID',400);
  const buffer=Buffer.alloc(length);
  let offset=0;
  while(offset<length){
    const {bytesRead}=await fd.read(buffer,offset,length-offset,position+offset);
    if(bytesRead<=0)fail('APK неожиданно обрывается.','APK_TRUNCATED',400);
    offset+=bytesRead;
  }
  return buffer;
}

function findEocd(tail,fileSize){
  for(let offset=tail.length-22;offset>=0;offset--){
    if(tail.readUInt32LE(offset)!==EOCD_SIGNATURE)continue;
    const commentLength=tail.readUInt16LE(offset+20);
    if(offset+22+commentLength!==tail.length)continue;
    const centralSize=tail.readUInt32LE(offset+12);
    const centralOffset=tail.readUInt32LE(offset+16);
    if(centralSize===NO_INDEX||centralOffset===NO_INDEX)fail('ZIP64 APK пока не поддерживается.','APK_ZIP64_UNSUPPORTED',400);
    if(centralOffset+centralSize>fileSize)fail('Некорректный центральный каталог APK.','APK_ZIP_INVALID',400);
    return {centralOffset,centralSize};
  }
  fail('Не найден ZIP-каталог APK.','APK_ZIP_INVALID',400);
}

async function readZipDirectory(fd,fileSize){
  const tailLength=Math.min(fileSize,65_557);
  const tail=await readExact(fd,fileSize-tailLength,tailLength);
  const info=findEocd(tail,fileSize);
  if(info.centralSize>MAX_CENTRAL_DIRECTORY_BYTES)fail('Центральный каталог APK слишком большой.','APK_ZIP_INVALID',400);
  const central=await readExact(fd,info.centralOffset,info.centralSize);
  return {...info,central};
}

function locateZipEntry(central,target){
  let offset=0;
  while(offset+46<=central.length){
    if(central.readUInt32LE(offset)!==CENTRAL_SIGNATURE)fail('Повреждён центральный каталог APK.','APK_ZIP_INVALID',400);
    const method=central.readUInt16LE(offset+10);
    const compressedSize=central.readUInt32LE(offset+20);
    const uncompressedSize=central.readUInt32LE(offset+24);
    const nameLength=central.readUInt16LE(offset+28);
    const extraLength=central.readUInt16LE(offset+30);
    const commentLength=central.readUInt16LE(offset+32);
    const localOffset=central.readUInt32LE(offset+42);
    const end=offset+46+nameLength+extraLength+commentLength;
    if(end>central.length)fail('Повреждена запись ZIP APK.','APK_ZIP_INVALID',400);
    const name=central.subarray(offset+46,offset+46+nameLength).toString('utf8');
    if(name===target){
      if(compressedSize===NO_INDEX||uncompressedSize===NO_INDEX||localOffset===NO_INDEX)fail('ZIP64 entry не поддерживается.','APK_ZIP64_UNSUPPORTED',400);
      return {method,compressedSize,uncompressedSize,localOffset,name};
    }
    offset=end;
  }
  return null;
}

async function extractEntry(fd,entry){
  if(entry.uncompressedSize>MAX_MANIFEST_BYTES||entry.compressedSize>MAX_MANIFEST_BYTES)fail('AndroidManifest.xml слишком большой.','APK_MANIFEST_INVALID',400);
  const local=await readExact(fd,entry.localOffset,30);
  if(local.readUInt32LE(0)!==LOCAL_SIGNATURE)fail('Повреждён локальный ZIP-заголовок APK.','APK_ZIP_INVALID',400);
  const nameLength=local.readUInt16LE(26),extraLength=local.readUInt16LE(28);
  const dataOffset=entry.localOffset+30+nameLength+extraLength;
  const compressed=await readExact(fd,dataOffset,entry.compressedSize);
  let output;
  if(entry.method===0)output=compressed;
  else if(entry.method===8)output=inflateRawSync(compressed);
  else fail('Неподдерживаемый метод сжатия AndroidManifest.xml.','APK_ZIP_METHOD_UNSUPPORTED',400);
  if(output.length!==entry.uncompressedSize)fail('Размер AndroidManifest.xml не совпадает с ZIP-каталогом.','APK_MANIFEST_INVALID',400);
  return output;
}

function readLength8(buffer,offset){
  if(offset>=buffer.length)fail('Повреждён string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  const first=buffer[offset];
  if((first&0x80)===0)return {value:first,next:offset+1};
  if(offset+1>=buffer.length)fail('Повреждён string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  return {value:((first&0x7f)<<8)|buffer[offset+1],next:offset+2};
}
function readLength16(buffer,offset){
  if(offset+2>buffer.length)fail('Повреждён string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  const first=buffer.readUInt16LE(offset);
  if((first&0x8000)===0)return {value:first,next:offset+2};
  if(offset+4>buffer.length)fail('Повреждён string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  return {value:((first&0x7fff)<<16)|buffer.readUInt16LE(offset+2),next:offset+4};
}

function parseStringPool(buffer,chunkOffset){
  if(chunkOffset+28>buffer.length)fail('Повреждён string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  const headerSize=buffer.readUInt16LE(chunkOffset+2),chunkSize=buffer.readUInt32LE(chunkOffset+4);
  const count=buffer.readUInt32LE(chunkOffset+8),flags=buffer.readUInt32LE(chunkOffset+16),stringsStart=buffer.readUInt32LE(chunkOffset+20);
  if(headerSize<28||chunkSize<headerSize||chunkOffset+chunkSize>buffer.length||count>100_000)fail('Некорректный string pool AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
  const utf8=(flags&0x100)!==0;
  const offsetsStart=chunkOffset+headerSize;
  if(offsetsStart+count*4>chunkOffset+chunkSize)fail('Некорректные offsets string pool.','APK_MANIFEST_INVALID',400);
  const strings=Array.from({length:count},(_,index)=>{
    const relative=buffer.readUInt32LE(offsetsStart+index*4);
    let cursor=chunkOffset+stringsStart+relative;
    if(cursor<chunkOffset||cursor>=chunkOffset+chunkSize)fail('Некорректная строка AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
    if(utf8){
      const utf16Len=readLength8(buffer,cursor);cursor=utf16Len.next;
      const byteLen=readLength8(buffer,cursor);cursor=byteLen.next;
      if(cursor+byteLen.value>chunkOffset+chunkSize)fail('Обрезана строка AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
      return buffer.subarray(cursor,cursor+byteLen.value).toString('utf8');
    }
    const charLen=readLength16(buffer,cursor);cursor=charLen.next;
    const bytes=charLen.value*2;
    if(cursor+bytes>chunkOffset+chunkSize)fail('Обрезана UTF-16 строка AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
    return buffer.subarray(cursor,cursor+bytes).toString('utf16le');
  });
  return {strings,size:chunkSize};
}

function typedAttributeValue(buffer,offset,strings){
  const rawIndex=buffer.readUInt32LE(offset+8);
  if(rawIndex!==NO_INDEX)return strings[rawIndex]??'';
  const type=buffer[offset+15],data=buffer.readUInt32LE(offset+16);
  if(type===0x03)return strings[data]??'';
  if(type===0x10||type===0x11)return data;
  return data;
}

export function parseBinaryAndroidManifest(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<8||buffer.readUInt16LE(0)!==0x0003)fail('AndroidManifest.xml не является бинарным Android XML.','APK_MANIFEST_INVALID',400);
  let offset=buffer.readUInt16LE(2);
  if(offset<8)offset=8;
  let strings=null;
  while(offset+8<=buffer.length){
    const type=buffer.readUInt16LE(offset),headerSize=buffer.readUInt16LE(offset+2),size=buffer.readUInt32LE(offset+4);
    if(size<8||headerSize<8||offset+size>buffer.length)fail('Повреждён AndroidManifest.xml.','APK_MANIFEST_INVALID',400);
    if(type===0x0001){
      const pool=parseStringPool(buffer,offset);strings=pool.strings;
    }else if(type===0x0102&&strings){
      if(headerSize<16||offset+36>buffer.length)fail('Повреждён manifest node.','APK_MANIFEST_INVALID',400);
      const ext=offset+16;
      const nameIndex=buffer.readUInt32LE(ext+4);
      const elementName=strings[nameIndex]??'';
      if(elementName==='manifest'){
        const attributeStart=buffer.readUInt16LE(ext+8);
        const attributeSize=buffer.readUInt16LE(ext+10);
        const attributeCount=buffer.readUInt16LE(ext+12);
        if(attributeSize<20||attributeCount>256)fail('Некорректные атрибуты manifest.','APK_MANIFEST_INVALID',400);
        const attrs={};
        let attrOffset=ext+attributeStart;
        for(let i=0;i<attributeCount;i++,attrOffset+=attributeSize){
          if(attrOffset+20>offset+size)fail('Обрезан атрибут manifest.','APK_MANIFEST_INVALID',400);
          const attrName=strings[buffer.readUInt32LE(attrOffset+4)]??'';
          attrs[attrName]=typedAttributeValue(buffer,attrOffset,strings);
        }
        const packageName=String(attrs.package||'');
        const versionName=String(attrs.versionName||'');
        const versionCode=Number(attrs.versionCode||0);
        if(!packageName||!versionName||!Number.isInteger(versionCode)||versionCode<=0)fail('В APK не найдены package/versionName/versionCode.','APK_MANIFEST_FIELDS_MISSING',400);
        return {packageName,versionName,versionCode};
      }
    }
    offset+=size;
  }
  fail('В AndroidManifest.xml не найден элемент manifest.','APK_MANIFEST_INVALID',400);
}

function readLp(buffer,offset){
  if(offset+4>buffer.length)fail('Повреждён APK Signing Block.','APK_SIGNATURE_INVALID',400);
  const length=buffer.readUInt32LE(offset);
  const start=offset+4,end=start+length;
  if(length<0||end>buffer.length)fail('Повреждён length-prefixed блок подписи APK.','APK_SIGNATURE_INVALID',400);
  return {value:buffer.subarray(start,end),next:end};
}

function certificateFromSchemeValue(value){
  const signer=readLp(value,0).value;
  const signedData=readLp(signer,0).value;
  const digests=readLp(signedData,0);
  const certificates=readLp(signedData,digests.next).value;
  const certificate=readLp(certificates,0).value;
  if(!certificate.length)fail('В подписи APK отсутствует сертификат.','APK_CERTIFICATE_MISSING',400);
  return certificate;
}

function parseSigningPairs(block){
  const result=[];
  let offset=8;
  const end=block.length-24;
  while(offset<end){
    if(offset+12>end)fail('Повреждена пара APK Signing Block.','APK_SIGNATURE_INVALID',400);
    const pairLengthBig=block.readBigUInt64LE(offset);
    if(pairLengthBig>BigInt(Number.MAX_SAFE_INTEGER))fail('Слишком большой блок подписи APK.','APK_SIGNATURE_INVALID',400);
    const pairLength=Number(pairLengthBig);
    if(pairLength<4)fail('Некорректная длина APK Signing Block.','APK_SIGNATURE_INVALID',400);
    const next=offset+8+pairLength;
    if(next>end)fail('Обрезан APK Signing Block.','APK_SIGNATURE_INVALID',400);
    const id=block.readUInt32LE(offset+8);
    result.push({id,value:block.subarray(offset+12,next)});
    offset=next;
  }
  if(offset!==end)fail('Некорректная граница APK Signing Block.','APK_SIGNATURE_INVALID',400);
  return result;
}

async function inspectSigningBlock(fd,centralOffset){
  if(centralOffset<24)fail('APK не содержит современную подпись v2/v3.','APK_SIGNATURE_UNSUPPORTED',400);
  const footer=await readExact(fd,centralOffset-24,24);
  if(!footer.subarray(8).equals(APK_SIG_MAGIC))fail('APK должен быть подписан схемой APK Signature Scheme v2/v3.','APK_SIGNATURE_UNSUPPORTED',400);
  const sizeBig=footer.readBigUInt64LE(0);
  if(sizeBig>BigInt(MAX_SIGNING_BLOCK_BYTES))fail('APK Signing Block слишком большой.','APK_SIGNATURE_INVALID',400);
  const size=Number(sizeBig),total=size+8,start=centralOffset-total;
  if(size<24||start<0)fail('Некорректный APK Signing Block.','APK_SIGNATURE_INVALID',400);
  const block=await readExact(fd,start,total);
  if(block.readBigUInt64LE(0)!==sizeBig||!block.subarray(block.length-16).equals(APK_SIG_MAGIC))fail('APK Signing Block не прошёл проверку границ.','APK_SIGNATURE_INVALID',400);
  const candidates=[
    {id:0x1b93ad61,label:'v3.1'},
    {id:0xf05368c0,label:'v3'},
    {id:0x7109871a,label:'v2'}
  ];
  const pairs=parseSigningPairs(block);
  for(const candidate of candidates){
    const pair=pairs.find(item=>item.id===candidate.id);
    if(!pair)continue;
    const certBytes=certificateFromSchemeValue(pair.value);
    let certificate;
    try{certificate=new X509Certificate(certBytes);}catch{fail('Сертификат подписи APK повреждён.','APK_CERTIFICATE_INVALID',400);}
    const fingerprint=normalizeFingerprint(certificate.fingerprint256);
    if(fingerprint.length!==64)fail('Не удалось вычислить SHA-256 сертификата APK.','APK_CERTIFICATE_INVALID',400);
    return {signatureScheme:candidate.label,signingCertSha256:fingerprint};
  }
  fail('В APK Signing Block нет поддерживаемой подписи v2/v3.','APK_SIGNATURE_UNSUPPORTED',400);
}

export async function inspectApkFile(path){
  const info=await stat(path);
  if(!info.isFile()||info.size<1024)fail('APK-файл отсутствует или пуст.','APK_FILE_INVALID',400);
  const fd=await open(path,'r');
  try{
    const directory=await readZipDirectory(fd,info.size);
    const manifestEntry=locateZipEntry(directory.central,'AndroidManifest.xml');
    if(!manifestEntry)fail('В APK отсутствует AndroidManifest.xml.','APK_MANIFEST_MISSING',400);
    const manifest=await extractEntry(fd,manifestEntry);
    const identity=parseBinaryAndroidManifest(manifest);
    const signing=await inspectSigningBlock(fd,directory.centralOffset);
    return {...identity,...signing};
  }finally{await fd.close();}
}

export function assertApkIdentity(inspection,releaseMeta,env=process.env){
  const expectedPackage=String(env.SB_ANDROID_PACKAGE_NAME||DEFAULT_ANDROID_PACKAGE_NAME).trim();
  if(inspection?.packageName!==expectedPackage)fail(`APK имеет package ${inspection?.packageName||'неизвестен'}, ожидается ${expectedPackage}.`,'APK_PACKAGE_MISMATCH',409);
  if(String(inspection?.versionName||'')!==String(releaseMeta?.versionName||''))fail(`versionName внутри APK (${inspection?.versionName||'—'}) не совпадает с указанной версией (${releaseMeta?.versionName||'—'}).`,'APK_VERSION_NAME_MISMATCH',409);
  if(Number(inspection?.versionCode)!==Number(releaseMeta?.versionCode))fail(`versionCode внутри APK (${inspection?.versionCode||'—'}) не совпадает с указанным build (${releaseMeta?.versionCode||'—'}).`,'APK_VERSION_CODE_MISMATCH',409);
  return true;
}

export async function trustedAndroidSigningFingerprints(env=process.env){
  const configured=String(env.SB_ANDROID_SIGNING_CERT_SHA256||'')
    .split(/[;,]/)
    .map(normalizeFingerprint)
    .filter(value=>value.length===64);
  if(configured.length)return configured;
  const referencePath=String(env.SB_ANDROID_TRUSTED_APK_PATH||'').trim()
    ||resolve(process.cwd(),'dist/downloads/sportbuddy78-rustore-v31.apk');
  try{
    const reference=await inspectApkFile(referencePath);
    const fingerprint=normalizeFingerprint(reference.signingCertSha256);
    return fingerprint.length===64?[fingerprint]:[];
  }catch{
    return [];
  }
}

export async function assertTrustedApkSigning(inspection,env=process.env){
  const trusted=await trustedAndroidSigningFingerprints(env);
  if(!trusted.length)fail('Не удалось определить production-сертификат Android из .env или эталонного APK v31. Публикация APK заблокирована.','APK_SIGNING_CERT_NOT_CONFIGURED',503);
  const actual=normalizeFingerprint(inspection?.signingCertSha256);
  if(!trusted.includes(actual))fail('APK подписан не production-сертификатом SportBuddy78. Публикация заблокирована.','APK_SIGNING_CERT_MISMATCH',409);
  return true;
}

export async function sha256File(path){
  const fd=await open(path,'r');
  const hash=createHash('sha256');
  try{
    const buffer=Buffer.alloc(1024*1024);
    let position=0;
    while(true){
      const {bytesRead}=await fd.read(buffer,0,buffer.length,position);
      if(!bytesRead)break;
      hash.update(buffer.subarray(0,bytesRead));
      position+=bytesRead;
    }
    return hash.digest('hex');
  }finally{await fd.close();}
}
