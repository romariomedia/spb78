import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
  console.error(`AndroidManifest.xml not found: ${manifestPath}`);
  console.error('Run "npx cap add android" first, or run this from a project that already has android/.');
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');
const marker = 'android:scheme="https"\n        android:host="sportbuddy78.pro"\n        android:pathPrefix="/vk-callback"';
if (xml.includes(marker)) {
  console.log('VK callback intent-filter already present.');
  process.exit(0);
}

const activityRe = /(<activity\b[^>]*android:name="(?:\\.|[^"]*MainActivity)"[^>]*)(>)/s;
const match = xml.match(activityRe);
if (!match) {
  console.error('MainActivity declaration was not found in AndroidManifest.xml.');
  process.exit(1);
}

let activityOpen = match[1];
if (!/android:launchMode=/.test(activityOpen)) {
  activityOpen += '\n            android:launchMode="singleTask"';
}

const filter = `\n            <intent-filter android:autoVerify="true">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data\n                    android:scheme="https"\n                    android:host="sportbuddy78.pro"\n                    android:pathPrefix="/vk-callback" />\n            </intent-filter>`;

xml = xml.replace(activityRe, `${activityOpen}>${filter}`);
fs.writeFileSync(manifestPath, xml);
console.log(`Patched ${manifestPath}`);
