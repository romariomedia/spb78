import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// The signed owner-supplied APK is stored in two parts to fit the repository connector's upload limit.
// Reassemble byte-for-byte; never re-sign or modify the application.
const root = new URL('../', import.meta.url);
const data = Buffer.concat(await Promise.all(['part-1','part-2'].map(part => readFile(new URL(`distribution/android/v31.apk.${part}`, root)))));
const expected = '37340c4a896817c72512fcae4755207e9dd5cdb7e8711d8df7ad51d9b06d7a5f';
if(data.length !== 20811542 || createHash('sha256').update(data).digest('hex') !== expected) throw new Error('Android download integrity check failed');
await mkdir(new URL('dist/downloads/',root),{recursive:true});
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v31.apk',root),data);
await writeFile(new URL('dist/downloads/sportbuddy78-rustore-v31.apk.sha256',root),`${expected}  sportbuddy78-rustore-v31.apk\n`);
console.log('Android v31 download prepared and SHA-256 verified');
