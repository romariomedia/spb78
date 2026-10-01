import { app } from '../lib/firebase';
import { auth,authReady } from './firebaseAuth';
import { callServer,apiBase } from './serverApi';
import { AppNotification } from '../lib/types';
const VAPID_KEY=import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BHbSDOyIjtjv-BhTNccn--WxIDzKfxdZBSzFwYt3Hk1VwJ7zkS2JcyS_qimguIP2bw0gLiHgCnh3pgDdGnsgAR4';
const TOKEN_KEY='sportbuddy-push-token';
export interface NotificationSettings {messages:boolean;friends:boolean;trainings:boolean;events:boolean;quiet:boolean;quietStart:number;quietEnd:number;radiusKm:number}
export const DEFAULT_SETTINGS:NotificationSettings={messages:true,friends:true,trainings:true,events:true,quiet:false,quietStart:23,quietEnd:8,radiusKm:25};
export async function pushIdentity(uid:string) {
  if(!('caches' in window))return;
  const cache=await caches.open('sportbuddy-push-identity-v1');
  await cache.put('/__push_identity',new Response(uid));
}
export async function enablePush():Promise<void> {
  if(window.Capacitor?.isNativePlatform?.())throw Error('Push для Android подключим в отдельном обновлении приложения. История уведомлений уже доступна.');
  if(!('Notification' in window)||!('serviceWorker' in navigator))throw Error('Этот браузер не поддерживает push. На iPhone добавьте сайт на экран «Домой» и откройте его оттуда.');
  // Ask from the button click, before any network request.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Разрешите уведомления в настройках сайта в браузере.');
  const {getMessaging,getToken,isSupported}=await import('firebase/messaging');
  if(!await isSupported())throw Error('Push недоступен в этом браузере.');
  const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  const token=await getToken(getMessaging(app),{vapidKey:VAPID_KEY,serviceWorkerRegistration:registration});
  if(!token)throw Error('Не удалось зарегистрировать устройство. Повторите позже.');
  await callServer('/api/notifications',{action:'register',token});
  await pushIdentity(auth.currentUser?.uid||'');
  try{localStorage.setItem(TOKEN_KEY,token);}catch{/* persistence disabled */}
}
export async function disablePush() {
  await pushIdentity('');
  const {getMessaging,deleteToken,isSupported}=await import('firebase/messaging');
  let token='';try{token=localStorage.getItem(TOKEN_KEY)||'';localStorage.removeItem(TOKEN_KEY);}catch{/* no storage */}
  try {if(token)await callServer('/api/notifications',{action:'unregister',token});}
  finally {if(await isSupported())await deleteToken(getMessaging(app));}
}
export function pushEnabled() {try{return typeof Notification!=='undefined'&&Notification.permission==='granted'&&!!localStorage.getItem(TOKEN_KEY);}catch{return false;}}
export async function restorePush(uid:string) {
  await authReady;
  if(auth.currentUser?.uid!==uid)return;
  await pushIdentity(uid);
  // No permission prompt on login. Refresh an already authorised token and owner.
  if(pushEnabled())await enablePush();
}
export const loadNotificationSettings=()=>callServer<{settings:NotificationSettings}>('/api/notifications',{action:'settings'});
export const saveNotificationSettings=(settings:NotificationSettings)=>callServer<{settings:NotificationSettings}>('/api/notifications',{action:'settings',settings});
export const readNotifications=(ids:string[])=>callServer('/api/notifications',{action:'read',ids});
export function subscribeNotifications(uid:string,onData:(items:AppNotification[])=>void,onError:(failed:boolean)=>void) {
  let stopped=false,controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>;
  async function connect(){
    await authReady;
    if(stopped)return;
    if(auth.currentUser?.uid!==uid){timer=setTimeout(connect,1000);return;}
    controller=new AbortController();
    try {
      const token=await auth.currentUser.getIdToken();
      const response=await fetch(apiBase()+'/api/notifications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'stream'}),signal:controller.signal});
      if(!response.ok||!response.body)throw Error('Stream unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(!stopped){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let boundary;
        while((boundary=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,boundary);buffer=buffer.slice(boundary+1);if(!line)continue;const data=JSON.parse(line);
          if(data.entries&&auth.currentUser?.uid===uid){onError(false);onData(data.entries.map((n:AppNotification&{createdAt:number})=>({...n,time:new Date(n.createdAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})})));}
        }
      }
    }catch{if(!stopped)onError(true);}
    if(!stopped)timer=setTimeout(connect,10000);
  }
  void connect();return()=>{stopped=true;clearTimeout(timer);controller?.abort();};
}

export const testPush=()=>callServer('/api/notifications',{action:'test'});

// Capture credentials before sign-out, without delaying logout or a subsequent login.
export function detachPushOnLogout() {
  const authorization=auth.currentUser?.getIdToken();
  let token='';try{token=localStorage.getItem(TOKEN_KEY)||'';localStorage.removeItem(TOKEN_KEY);}catch{/* unavailable */}
  void pushIdentity('').catch(()=>undefined);
  if(authorization&&token)void authorization.then(idToken=>fetch(apiBase()+'/api/notifications',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},
    body:JSON.stringify({action:'unregister',token}),keepalive:true,signal:AbortSignal.timeout(10000)
  })).catch(()=>undefined);
}
