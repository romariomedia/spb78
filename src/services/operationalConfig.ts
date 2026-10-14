import {useEffect,useState} from 'react';
import {LIVE_FEATURE_FLAGS,effectiveOperations} from '../../shared/operational-policy.js';
import {apiFetch,readApiJson} from './apiEndpoint';
export function useOperationalConfig(){
 const [config,setConfig]=useState({featureFlags:{...LIVE_FEATURE_FLAGS},maintenanceMode:false,maintenanceMessage:''});
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const refresh=async()=>{
   try{
    const response=await apiFetch('/api/app-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Не удалось обновить доступность функций.');
    const data=await readApiJson(response);
    if(alive){setConfig(effectiveOperations({operationsVersion:1,featureFlags:data.featureFlags,product:{maintenanceMode:data.maintenanceMode,maintenanceMessage:data.maintenanceMessage}}));setError('');}
   }catch{if(alive)setError('Не удалось обновить настройки сервиса. Повторим автоматически.');}
  };
  void refresh();
  const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);
  const focus=()=>{void refresh();};window.addEventListener('focus',focus);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',focus);};
 },[]);
 return {...config,error};
}
