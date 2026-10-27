import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import {cert} from 'firebase-admin/app';

// Add only this index; never deploy/delete unrelated indexes or rules.
const fields=[{fieldPath:'ownerUserId',order:'ASCENDING'},{fieldPath:'createdAt',order:'DESCENDING'},{fieldPath:'__name__',order:'DESCENDING'}];
try{
 const env=parse(await readFile(process.argv[2]||'/opt/sportbuddy-api/.env','utf8'));
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}');
 if(!account.project_id||!account.client_email||!account.private_key)throw Error('Service account configuration missing');
 const credential=cert(account);
 const base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/databases/(default)/collectionGroups/privacyRequests/indexes`;
 const request=async(url,method='GET',body)=>{
  const {access_token}=await credential.getAccessToken();
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Firestore index API HTTP ${response.status}. Check service-account index permissions and retry.`);
  return response.json();
 };
 let found;
 let pageToken;
 do{
  const page=await request(base+(pageToken?'?pageToken='+encodeURIComponent(pageToken):''));
  found=(page.indexes||[]).find(index=>index.queryScope==='COLLECTION'&&JSON.stringify(index.fields?.map(({fieldPath,order})=>({fieldPath,order})))===JSON.stringify(fields));
  pageToken=page.nextPageToken;
 }while(!found&&pageToken);
 if(!found){
  console.log('Creating privacyRequests index; existing indexes are unchanged.');
  const operation=await request(base,'POST',{queryScope:'COLLECTION',fields});
  const deadline=Date.now()+15*60*1000;
  let status=operation;
  while(!status.done&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,5000));status=await request('https://firestore.googleapis.com/v1/'+operation.name);}
  if(!status.done||status.error)throw Error('Index creation did not complete. Retry this command before activation.');
  found=status.response;
 }
 const deadline=Date.now()+15*60*1000;
 while(found?.state==='CREATING'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,5000));found=await request('https://firestore.googleapis.com/v1/'+found.name);}
 if(found?.state!=='READY')throw Error('Index is not READY. Do not activate yet; inspect it in Firebase Console.');
 console.log('privacyRequests index READY. Release activation is safe to proceed.');
}catch(error){
 // Never print credentials, SDK objects or the environment file.
 console.error(error.message?.startsWith('Firestore index API')||error.message?.startsWith('Index ')||error.message?.startsWith('Service account')?error.message:'Could not prepare privacy index. Check network, service account and Firebase Console.');
 process.exitCode=1;
}
