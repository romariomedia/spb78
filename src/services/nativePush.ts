import {Capacitor} from '@capacitor/core';
import {PushNotifications} from '@capacitor/push-notifications';
import {auth,authReady} from './firebaseAuth';
import {apiFetch} from './apiEndpoint';
import {nativePushDestination} from '../../shared/native-push.js';

const KEY='sportbuddy-native-push-token';
let generation=0;
let queue:Promise<unknown>=Promise.resolve();
export const isAndroidPush=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
export function nativePushToken(){try{return localStorage.getItem(KEY)||'';}catch{return '';}}
function remember(token:string){try{if(token)localStorage.setItem(KEY,token);else localStorage.removeItem(KEY);}catch{/* no storage */}}
function serialized<T>(task:()=>Promise<T>):Promise<T>{const result=queue.then(task,task);queue=result.catch(()=>{});return result;}
async function bindToken(token:string,user:NonNullable<typeof auth.currentUser>,action:'register'|'unregister'){
 const authorization=await user.getIdToken();
 const response=await apiFetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authorization},body:JSON.stringify({action,token,platform:'android'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Не удалось подключить уведомления к аккаунту. Повторите позже.');
}
async function obtainToken(){
 let resolveToken:(value:string)=>void=()=>{},rejectToken:(reason:Error)=>void=()=>{};
 const result=new Promise<string>((resolve,reject)=>{resolveToken=resolve;rejectToken=reject;});
 // Attach rejection handler before native setup, which may itself fail.
 void result.catch(()=>{});
 const registration=await PushNotifications.addListener('registration',token=>resolveToken(token.value));
 let errorListener:Awaited<ReturnType<typeof PushNotifications.addListener>>|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  errorListener=await PushNotifications.addListener('registrationError',()=>rejectToken(Error('Не удалось получить push-токен. Проверьте подключение и Google Play Services.')));
  timer=setTimeout(()=>rejectToken(Error('Регистрация уведомлений заняла слишком много времени. Повторите попытку.')),20000);
  await PushNotifications.register();
  return await result;
 }finally{clearTimeout(timer);await registration.remove();await errorListener?.remove();}
}
export function enableNativePush(prompt=true){
 const expected=generation,user=auth.currentUser;
 return serialized(async()=>{
  if(!user||auth.currentUser?.uid!==user.uid||expected!==generation)throw Error('Войдите в аккаунт заново.');
  let permission=await PushNotifications.checkPermissions();
  if(permission.receive!=='granted'&&prompt)permission=await PushNotifications.requestPermissions();
  if(permission.receive!=='granted'){remember('');throw Error('Разрешите уведомления SportBuddy78 в настройках Android.');}
  await PushNotifications.createChannel({id:'sportbuddy',name:'SportBuddy78',description:'Сообщения, друзья, тренировки и события',importance:4,visibility:0});
  const token=await obtainToken();
  if(expected!==generation||auth.currentUser?.uid!==user.uid)return;
  await bindToken(token,user,'register');
  if(expected!==generation||auth.currentUser?.uid!==user.uid){await bindToken(token,user,'unregister');return;}
  remember(token);
 });
}
export function disableNativePush(){
 generation++;
 const token=nativePushToken(),user=auth.currentUser;remember('');
 return serialized(async()=>{
  // Delete the FCM token even if the server is unreachable.
  try{if(token&&user)await bindToken(token,user,'unregister');}
  finally{try{await PushNotifications.removeAllDeliveredNotifications();}finally{await PushNotifications.unregister();}}
 });
}
let listening=false;
export async function initializeNativePush(){
 if(!isAndroidPush()||listening)return;listening=true;
 try{
  await PushNotifications.addListener('pushNotificationActionPerformed',async action=>{
   await authReady;
   const link=nativePushDestination(action.notification.data,auth.currentUser?.uid||'');
   if(!link)return;
   window.location.hash=link;
   window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
 }catch{listening=false;}
}
