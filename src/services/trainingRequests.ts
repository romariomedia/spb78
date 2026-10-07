import { callServer } from './serverApi';

type Pending = {id:string; fingerprint:string};
const memory=new Map<string,Pending>();
const active=new Map<string,{fingerprint:string;promise:Promise<unknown>}>();
// Keep the same operation across a lost response, including a page reload.
export function createTrainingRequest<T>(uid:string, training:unknown):Promise<T> {
  const key=`sportbuddy_training_request_v1:${uid}`;
  const fingerprint=JSON.stringify(training);
  const running=active.get(key);
  if(running){
    if(running.fingerprint!==fingerprint)return Promise.reject(new Error('Дождитесь завершения создания предыдущей тренировки'));
    return running.promise as Promise<T>;
  }
  let pending=memory.get(key);
  if(!pending){try{pending=JSON.parse(localStorage.getItem(key)||'null') as Pending|null||undefined;}catch{/* storage unavailable */}}
  if(!pending || pending.fingerprint!==fingerprint || !/^[a-zA-Z0-9_-]{8,100}$/.test(pending.id)){
    pending={id:crypto.randomUUID(),fingerprint};
  }
  const request=pending;
  memory.set(key,request);
  try{localStorage.setItem(key,JSON.stringify(request));}catch{/* memory keeps retries stable */}
  const clear=()=>{memory.delete(key);try{localStorage.removeItem(key);}catch{/* ignored */}};
  const promise=callServer<T>('/api/sportbuddy-mutation',{action:'training',operation:'createTraining',training,requestId:request.id})
    .then(result=>{clear();return result;})
    .catch(error=>{
      const status=Number((error as {status?:number})?.status);
      if(status>=400 && status<500 && ![408,429].includes(status))clear();
      throw error;
    }).finally(()=>active.delete(key));
  active.set(key,{fingerprint,promise});
  return promise;
}
