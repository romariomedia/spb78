import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { publicProfileCache } from './public-profile-cache.js';

const metrics = ['workouts', 'streak', 'boxes', 'medals'];
const demoIds = new Set(['user-me-1','user-anna','user-elena','user-maria','user-ekatery','user-daria','user-veronika']);
const fields = ['name','avatar','locationName','medalTier','rating','totalWorkouts',
  'totalDailyMedals','dailyMedalStreak','claimedBoxTiers','isDemo','isSuspended'];
const count = value => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;
const label = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';

// Only public display identity and numeric scores enter the shared snapshot.
export function rankingRow(id, user) {
  if (user.isSuspended === true || user.isDemo === true || demoIds.has(id)) return null;
  return {
    user: {id, name: label(user.name, 150) || 'Спортсмен', avatar: label(user.avatar, 4096),
      locationName: label(user.locationName, 200),
      medalTier: ['bronze','silver','gold'].includes(user.medalTier) ? user.medalTier : 'bronze'},
    rating: typeof user.rating === 'number' && Number.isFinite(user.rating) ? Math.max(0,Math.min(5,user.rating)) : 0,
    values: {workouts: count(user.totalWorkouts), medals: count(user.totalDailyMedals),
      streak: count(user.dailyMedalStreak), boxes: Array.isArray(user.claimedBoxTiers) ? user.claimedBoxTiers.length : 0}
  };
}
export function rankingSnapshot(rows) {
  const visible = rows.filter(Boolean);
  return {version: randomUUID(), updatedAt: new Date().toISOString(), rows: visible,
    stats: visible.reduce((s,row)=>({athletes:s.athletes+1,workouts:s.workouts+row.values.workouts,
      medals:s.medals+row.values.medals,boxes:s.boxes+row.values.boxes}),
    {athletes:0,workouts:0,medals:0,boxes:0})};
}
export function validateRankingRequest({metric='workouts', offset=0, version}={}) {
  if (!metrics.includes(metric) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000
    || (offset > 0 && (typeof version !== 'string' || !version || version.length > 100)))
    throw Object.assign(new Error('Некорректная страница рейтинга'), {status:400});
}
export function rankingPage(snapshot, uid, body={}) {
  validateRankingRequest(body);
  const {metric='workouts',offset=0,version}=body;
  if (offset > 0 && version !== snapshot.version)
    throw Object.assign(new Error('Рейтинг обновился. Загрузите его заново.'), {status:409});
  const sorted = [...snapshot.rows].sort((a,b)=>b.values[metric]-a.values[metric] || b.rating-a.rating
    || (a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0));
  const entry = (row,index)=>({rank:index+1,user:row.user,value:row.values[metric]});
  const ownIndex = sorted.findIndex(row=>row.user.id===uid);
  return {metric,version:snapshot.version,updatedAt:snapshot.updatedAt,stats:snapshot.stats,
    entries: sorted.slice(offset,offset+20).map((row,index)=>entry(row,offset+index)),
    myEntry: ownIndex<0?null:entry(sorted[ownIndex],ownIndex),
    maxValue: sorted[0]?.values[metric] ?? 0,
    top3Value: sorted.length>=3?sorted[2].values[metric]:null,
    nextOffset: offset+20<sorted.length?offset+20:null};
}
export async function loadRanking(db, uid, body) {
  validateRankingRequest(body);
  const snapshot = await publicProfileCache(db).get('leaderboard:v1', async()=>{
    const rows=[];
    let cursor;
    do {
      let query=db.collection('users').orderBy(FieldPath.documentId()).select(...fields).limit(500);
      if(cursor)query=query.startAfter(cursor);
      const result=await query.get();
      rows.push(...result.docs.map(doc=>rankingRow(doc.id,doc.data())).filter(Boolean));
      cursor=result.docs.length===500?result.docs.at(-1).id:null;
    } while(cursor);
    return rankingSnapshot(rows);
  });
  return rankingPage(snapshot,uid,body);
}
