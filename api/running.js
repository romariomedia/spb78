import routes from '../shared/running-routes.json' with {type:'json'};
import {createHash} from 'node:crypto';
import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {writeResult,routeKey} from '../server/running-results.js';
import {validateRun} from '../shared/running.js';
if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try {
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    const {uid}=await getAuth().verifyIdToken(token,true),db=getFirestore();
    await requireActiveUser(db,uid);
    const b=req.body||{};
    if(b.action==='history'){
      const snap=await db.collection('runningResults').where('userId','==',uid).orderBy('endedAt','desc').limit(50).get();
      return res.json({runs:snap.docs.map(d=>d.data())});
    }
    if(b.action==='leaders'){
      const route=routes.find(r=>r.id===b.routeId);
      // No rankings until a dense, field-verified reference track is shipped.
      if(!route?.verified)return res.json({leaders:[],available:false,reason:'Рейтинг откроется после проверки точной трассы.'});
      const key=routeKey({routeId:route.id,routeVersion:route.version});
      const snap=await db.collection('runningBest').where('routeKey','==',key).orderBy('elapsedMs','asc').limit(100).get();
      const candidates=snap.docs.map(d=>d.data());
      const profiles=await Promise.all(candidates.map(r=>db.collection('users').doc(r.userId).get()));
      const leaders=candidates.flatMap((r,i)=>{const p=profiles[i];return p.exists&&p.data().isSuspended!==true?[{...r,name:String(p.data().name||'Бегун').slice(0,80)}]:[];});
      return res.json({leaders,available:true,reason:leaders.length?'':'Пока нет опубликованных результатов. Станьте первым!'});
    }
    if(b.action==='save'){
      if(typeof b.run?.id!=='string'||!/^run_[a-zA-Z0-9-]{8,80}$/.test(b.run.id))return res.status(400).json({error:'Некорректный ID пробежки'});
      const run=b.run, route=routes.find(r=>r.id===run.routeId);
      if(run.routeId&&!route)return res.status(400).json({error:'Маршрут не найден'});
      const version=run.routeVersion ?? 0;
      if(!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'Некорректная версия маршрута'});
      const sameVersion=!route||version===route.version;
      const result=validateRun(run,route&&!sameVersion?{...route,verified:false}:route);
      if(route&&!sameVersion)result.reason='Версия маршрута изменилась или не указана. Результат сохранён без участия в рейтинге.';
      const fingerprint=createHash('sha256').update(JSON.stringify({startedAt:run.startedAt,endedAt:run.endedAt,routeId:run.routeId||'',routeVersion:version,points:run.points,publish:run.publish===true})).digest('hex');
      const value={id:run.id,userId:uid,routeId:route?.id||'',routeVersion:route?version:0,startedAt:run.startedAt,endedAt:run.endedAt,...result,fingerprint,createdAt:Date.now(),published:result.eligible&&run.publish===true};
      const saved=await writeResult(db,uid,{...value,routeKey:routeKey(value)},run.id);
      return res.json({run:saved});
    }
    if(b.action==='delete'){
      if(typeof b.id!=='string'||!/^run_[a-zA-Z0-9-]{8,80}$/.test(b.id))return res.status(400).json({error:'Некорректный ID'});
      await writeResult(db,uid,null,b.id,true);
      return res.json({ok:true});
    }
    return res.status(400).json({error:'Неизвестное действие'});
  }catch(error){
    const status=error?.status||(String(error?.code||'').startsWith('auth/')?401:500);
    return res.status(status).json({error:status===500?'Не удалось обработать пробежку. Повторите попытку.':error.message});
  }
}
