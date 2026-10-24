import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// The signed owner-supplied APK is stored in two parts to fit the repository connector's upload limit.
// Reassemble byte-for-byte; never re-sign or modify the application.
const root = new URL('../', import.meta.url);
const data = Buffer.concat(await Promise.all(['part-1','part-2'].map(part => readFile(new URL(`distribution/android/v27.apk.${part}`, root)))));
const expected = '4e76fc2a9b96b3758872959255bfec64fbb8fb27cecf87e81efed0caa1ee469f';
if(data.length !== 20751829 || createHash('sha256').update(data).digest('hex') !== expected) throw new Error('Android download integrity check failed');
await mkdir(new URL('dist/downloads/',root),{recursive:true});
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v27.apk',root),data);
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v27.apk.sha256',root),`${expected}  sportbuddy78-rustore-v27.apk\n`);
console.log('Android v27 download prepared and SHA-256 verified');
