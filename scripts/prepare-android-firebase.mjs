import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const path='android/app/google-services.json';
const input=process.env.FIREBASE_ANDROID_GOOGLE_SERVICES_JSON;
if(!input&&!existsSync(path))throw Error('Add GitHub Actions secret FIREBASE_ANDROID_GOOGLE_SERVICES_JSON containing Firebase Android google-services.json for ru.sportbuddy.mobile.');
let config;
try{config=JSON.parse(input||readFileSync(path,'utf8'));}catch{throw Error('Android Firebase configuration must be valid JSON.');}
if(config.project_info?.project_id!=='sportbuddy-spb'||String(config.project_info?.project_number)!=='513842673754')throw Error('Wrong Firebase project: expected sportbuddy-spb.');
const client=config.client?.find(c=>c.client_info?.android_client_info?.package_name==='ru.sportbuddy.mobile');
if(!client?.client_info?.mobilesdk_app_id||!client.api_key?.[0]?.current_key)throw Error('Missing Firebase Android client ru.sportbuddy.mobile. Download its google-services.json from Firebase Project settings.');
writeFileSync(path,JSON.stringify(config,null,2)+'\n',{mode:0o600});
console.log('Android Firebase configuration validated.');
