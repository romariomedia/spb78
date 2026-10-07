import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession } from '../server/admin-control.js';
import { ADMIN_EMAIL } from '../server/user-lifecycle.js';
import { analyticsDayKey,parseMillis,percent,shiftAnalyticsDay } from '../server/analytics.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const safeNumber=value=>Number.isFinite(Number(value))?Number(value):0;

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    await requireAdminSession(db,body.sessionId);
    const today=analyticsDayKey(Date.now());
    const days14=Array.from({length:14},(_,i)=>shiftAnalyticsDay(today,i-13));
    const last7=days14.slice(-7),prev7=days14.slice(0,7);
    const [usersSnap,activitySnap,adminAuth]=await Promise.all([
      db.collection('users').get(),
      db.collection('analyticsDaily').where('day','in',days14).get(),
      getAuth().getUserByEmail(ADMIN_EMAIL).catch(()=>null)
    ]);

    const excluded=new Set();
    const users=[];
    for(const doc of usersSnap.docs){
      const data=doc.data()||{};
      if(data.isDemo===true||data.analyticsExcluded===true||doc.id===adminAuth?.uid){excluded.add(doc.id);continue;}
      const registeredMs=parseMillis(data.registeredAt);
      users.push({id:doc.id,registeredMs,registeredDay:Number.isFinite(registeredMs)?analyticsDayKey(registeredMs):''});
    }

    const activity=(activitySnap?.docs||[])
      .map(doc=>({id:doc.id,...doc.data()}))
      .filter(row=>row.userId&&!excluded.has(row.userId));

    const daily=last7.map(day=>{
      const rows=activity.filter(row=>row.day===day);
      const activeUsers=new Set(rows.map(row=>row.userId));
      const activeSeconds=rows.reduce((sum,row)=>sum+safeNumber(row.activeSeconds),0);
      const sessions=rows.reduce((sum,row)=>sum+safeNumber(row.sessions),0);
      const registrations=users.filter(user=>user.registeredDay===day).length;
      return {
        day,registrations,dau:activeUsers.size,
        activeSeconds,sessions,
        avgMinutesPerActiveUser:activeUsers.size?Math.round(activeSeconds/activeUsers.size/6)/10:0
      };
    });

    const registrations7d=users.filter(user=>last7.includes(user.registeredDay)).length;
    const registrationsPrev7d=users.filter(user=>prev7.includes(user.registeredDay)).length;
    const todayRows=activity.filter(row=>row.day===today);
    const yesterday=shiftAnalyticsDay(today,-1);
    const todayActive=new Set(todayRows.map(row=>row.userId));
    const yesterdayActive=new Set(activity.filter(row=>row.day===yesterday).map(row=>row.userId));
    const wauUsers=new Set(activity.filter(row=>last7.includes(row.day)).map(row=>row.userId));

    const retentionDay=yesterday;
    const cohortDay=shiftAnalyticsDay(retentionDay,-7);
    const cohort=users.filter(user=>user.registeredDay===cohortDay);
    const retained=cohort.filter(user=>yesterdayActive.has(user.id)).length;

    const rows7=activity.filter(row=>last7.includes(row.day));
    const userDays=rows7.length;
    const seconds7=rows7.reduce((sum,row)=>sum+safeNumber(row.activeSeconds),0);
    const sessions7=rows7.reduce((sum,row)=>sum+safeNumber(row.sessions),0);
    const trackingTimes=activity.map(row=>safeNumber(row.firstSeenAt)).filter(Boolean).sort((a,b)=>a-b);

    return res.json({
      generatedAt:new Date().toISOString(),
      timezone:'Europe/Moscow',
      observedWindowStartedAt:trackingTimes[0]?new Date(trackingTimes[0]).toISOString():'',
      coverageDays:new Set(activity.map(row=>row.day)).size,
      metrics:{
        registrations7d,
        registrationsPrev7d,
        registrationsDelta:registrations7d-registrationsPrev7d,
        registrationsChangePct:registrationsPrev7d?percent(registrations7d-registrationsPrev7d,registrationsPrev7d):null,
        dau:todayActive.size,
        dauYesterday:yesterdayActive.size,
        dauDelta:todayActive.size-yesterdayActive.size,
        wau:wauUsers.size,
        retentionD7:activity.some(row=>row.day===retentionDay)?percent(retained,cohort.length):null,
        retentionDay,
        retentionCohort:cohort.length,
        retentionReturned:retained,
        avgActiveMinutes7d:userDays?Math.round(seconds7/userDays/6)/10:0,
        avgSessionMinutes7d:sessions7?Math.round(seconds7/sessions7/6)/10:0,
        activeUserDays7d:userDays
      },
      daily
    });
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-analytics]',error);
    return res.status(status).json({error:status===500?'Analytics dashboard unavailable.':error.message});
  }
}
