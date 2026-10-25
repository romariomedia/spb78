import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// The signed owner-supplied APK is stored in two parts to fit the repository connector's upload limit.
// Reassemble byte-for-byte; never re-sign or modify the application.
const root = new URL('../', import.meta.url);
const data = Buffer.concat(await Promise.all(['part-1','part-2'].map(part => readFile(new URL(`distribution/android/v28.apk.${part}`, root)))));
const expected = '643fda2ab52e1c0ad30b07e2ac7e8c02ee044e2df161be7e5242a85b3b22a2d7';
if(data.length !== 20757933 || createHash('sha256').update(data).digest('hex') !== expected) throw new Error('Android download integrity check failed');
await mkdir(new URL('dist/downloads/',root),{recursive:true});
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v28.apk',root),data);
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v28.apk.sha256',root),`${expected}  sportbuddy78-rustore-v28.apk\n`);
console.log('Android v28 download prepared and SHA-256 verified');
