import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {cleanupStories} from './stories.js';
export function startStoryWorker(){
 let running=false,stopped=false;
 const sweep=async()=>{if(running||stopped)return;running=true;try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  await cleanupStories(getFirestore());
 }catch(e){console.error('[stories] cleanup failed',e.code||e.name);}finally{running=false;}};
 const timer=setInterval(()=>void sweep(),10*60*1000);timer.unref();void sweep();
 return()=>{stopped=true;clearInterval(timer);};
}
