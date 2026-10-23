import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const root = new URL('../ios/App/App/Assets.xcassets/', import.meta.url);
const source = new URL('../store-assets/icon/icon-1024.png', import.meta.url);
const icon = new URL('AppIcon.appiconset/AppIcon-512@2x.png', root);
const splash = new URL('Splash.imageset/splash.png', root);
await mkdir(new URL('AppIcon.appiconset/', root), {recursive: true});
await mkdir(new URL('Splash.imageset/', root), {recursive: true});
await sharp(source.pathname).resize(1024, 1024).flatten({background: '#020617'}).png().toFile(icon.pathname);
const logo = await sharp(source.pathname).resize(480, 480).png().toBuffer();
await sharp({create: {width: 1366, height: 1366, channels: 3, background: '#020617'}})
  .composite([{input: logo, gravity: 'centre'}]).png().toFile(splash.pathname);
const meta = await sharp(icon.pathname).metadata();
if (meta.width !== 1024 || meta.height !== 1024 || meta.hasAlpha) throw new Error('Invalid iOS app icon');
console.log('iOS icon and launch image prepared from the shared S78 logo');
