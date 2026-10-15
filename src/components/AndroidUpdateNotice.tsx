import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {apiFetch,readApiJson} from '../services/apiEndpoint';
import {androidUpdatePolicy,needsAndroidUpdate,type AndroidUpdatePolicy} from '../../shared/android-update.js';

export function AndroidUpdateNotice(){
 const [notice,setNotice]=useState<AndroidUpdatePolicy|null>(null);
 const [dismissed,setDismissed]=useState('');
 useEffect(()=>{
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return;
  let alive=true,busy=false;
  let controller:AbortController|undefined;
  const refresh=async()=>{
   if(busy||document.hidden)return;
   busy=true;
   controller=new AbortController();
   const requestController=controller;
   const timeout=setTimeout(()=>requestController.abort(),15000);
   try{
    const info=await App.getInfo();
    const response=await apiFetch('/api/app-config',{cache:'no-store',signal:requestController.signal});
    if(!response.ok)throw new Error('Unavailable');
    const data=await readApiJson(response),policy=androidUpdatePolicy(data.product);
    if(alive)setNotice(needsAndroidUpdate(info.build,policy)?policy:null);
   }catch{/* Network failure must not prevent access to the app. */}
   finally{clearTimeout(timeout);busy=false;}
  };
  void refresh();
  const focus=()=>{void refresh();};
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{alive=false;controller?.abort();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[]);
 if(!notice||dismissed===notice.minimumAndroidVersion)return null;
 return <section role="status" aria-label="Обновление приложения" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[10000] mx-auto max-w-lg rounded-2xl border border-lime-300/40 bg-slate-950 p-4 text-white shadow-2xl">
  <p className="font-bold text-lime-300">Обнови SportBuddy78</p>
  <p className="mt-1 text-sm text-slate-200">Установлена старая сборка. Обновление поможет пользоваться всеми возможностями проекта.</p>
  <div className="mt-3 flex items-center gap-3">
   <a href={notice.ruStoreUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-lime-300 px-4 py-3 font-bold text-slate-950">Открыть RuStore</a>
   <button type="button" onClick={()=>setDismissed(notice.minimumAndroidVersion)} className="rounded-xl px-4 py-3 text-slate-200">Позже</button>
  </div>
 </section>;
}
