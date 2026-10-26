import {readAdminUserPage} from '../server/admin-user-page.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const iso = value => value?.toDate ? value.toDate().toISOString() : String(value || '');
const list = (value, max = 12) => Array.isArray(value) ? value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean).slice(0, max) : [];
function addCalendarMonths(value, months) {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

function userRow(doc, privateData = {}, adminData = {}) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: text(data.name, 120) || 'Спортсмен',
    email: text(privateData.email || data.email, 180),
    districtId: text(data.districtId, 80),
    sports: list(data.sports, 8),
    avatar: text(data.avatar, 2000),
    isVerified: data.isVerified === true,
    verifiedAt: iso(data.verifiedAt),
    registeredAt: iso(data.registeredAt),
    lastSeenAt: Number(data.lastSeenAt || 0),
    premiumUntil: iso(data.premiumUntil),
    hasRealPhoto: data.hasRealPhoto === true,
    subscriptionPlan: data.subscriptionPlan === 'premium' ? 'premium' : 'free',
    isSuspended: data.isSuspended === true,
    analyticsExcluded: data.analyticsExcluded === true,
    isPersonalTrainer: data.personalTrainer?.enabled === true,
    foundingCoach: adminData.foundingCoach === true,
    foundingCoachSince: iso(adminData.foundingCoachSince),
    foundingCoachFreeUntil: iso(adminData.foundingCoachFreeUntil),
    foundingCoachGrantedBy: text(adminData.foundingCoachGrantedBy, 180),
    suspensionReason: data.isSuspended === true ? text(adminData.suspensionReason, 300) : ''
  };
}

async function readUserDetails(db, userId) {
  const [snap, privateSnap, adminSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('usersPrivate').doc(userId).get(),
    db.collection('userAdmin').doc(userId).get()
  ]);
  if (!snap.exists) throw Object.assign(new Error('User not found.'), { status:404 });
  const data = snap.data() || {};
  const privateData = privateSnap?.exists ? privateSnap.data() || {} : {};
  const adminData = adminSnap?.exists ? adminSnap.data() || {} : {};
  return {
    ...userRow(snap, privateData, adminData),
    age: Number(data.age || 0),
    gender: data.gender === 'female' ? 'female' : 'male',
    bio: text(data.bio, 1000),
    locationName: text(data.locationName, 200),
    provider: text(data.provider, 30),
    totalWorkouts: Number(data.totalWorkouts || 0),
    totalDailyMedals: Number(data.totalDailyMedals || 0),
    dailyMedalStreak: Number(data.dailyMedalStreak || 0),
    rating: Number(data.rating || 0),
    ratingCount: Number(data.ratingCount || 0),
    friendsCount: list(data.friendIds, 500).length,
    matchesCount: list(data.matchIds, 500).length,
    photoPortfolioCount: list(data.photoPortfolio, 20).length,
    suspendedAt: iso(adminData.suspendedAt),
    suspendedBy: text(adminData.suspendedBy, 180)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const db = getFirestore();
  const body = req.body || {};
  try {
    const session = await requireAdminSession(db, body.sessionId);
    const operation = String(body.operation || 'list');
    if (operation === 'list') return res.json(await readAdminUserPage(db, getAuth(), userRow, body.query, body.cursor));

    const userId = text(body.userId, 180);
    if (!userId || userId.includes('/')) return res.status(400).json({ error:'User id required.' });
    if (operation === 'get') return res.json({ user: await readUserDetails(db, userId) });

    const ref = db.collection('users').doc(userId);
    const privateRef = db.collection('usersPrivate').doc(userId);
    const adminRef = db.collection('userAdmin').doc(userId);
    const [beforeSnap, privateSnap, adminSnap] = await Promise.all([ref.get(), privateRef.get(), adminRef.get()]);
    if (!beforeSnap.exists) return res.status(404).json({ error:'User not found.' });
    const before = beforeSnap.data() || {};
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};
    const adminData = adminSnap.exists ? adminSnap.data() || {} : {};
    let patch = {};
    if(['setVerification','setPremiumUntil','setAnalyticsExcluded'].includes(operation)){
      const reason=text(body.reason,300);
      if(operation!=='setAnalyticsExcluded' && reason.length<3)return res.status(400).json({error:'Укажите причину изменения (минимум 3 символа).'});
      if(operation==='setVerification')patch=body.verified===true
        ?{isVerified:true,verifiedAt:new Date().toISOString()}
        :{isVerified:false,verifiedAt:FieldValue.delete()};
      if(operation==='setAnalyticsExcluded')patch={analyticsExcluded:body.excluded===true};
      if(operation==='setPremiumUntil'){
        const raw=text(body.premiumUntil,40),date=raw?new Date(raw):null;
        if(date&&!Number.isFinite(date.getTime()))return res.status(400).json({error:'Invalid premium date.'});
        patch={premiumUntil:date?Timestamp.fromDate(date):FieldValue.delete()};
      }
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        if(!fresh.exists)throw Object.assign(new Error('User not found.'),{status:404});
        const old=fresh.data();
        const snapshot=data=>({isVerified:data.isVerified===true,premiumUntil:iso(data.premiumUntil),analyticsExcluded:data.analyticsExcluded===true});
        const next={...old,...patch};
        if(operation==='setPremiumUntil')next.premiumUntil=body.premiumUntil||'';
        tx.update(ref,patch);
        await writeAdminAudit(db,session,{action:'user.'+operation,entityType:'user',entityId:userId,before:snapshot(old),after:{...snapshot(next),reason},requestId:String(body.requestId||'')},tx);
      });
      return res.json({ok:true,user:await readUserDetails(db,userId)});
    } else if (operation === 'setFoundingCoach') {
      const enabled = body.enabled === true;
      const now = new Date();
      const freeUntil = addCalendarMonths(now, 3);
      await db.runTransaction(async tx => {
        const [fresh, freshAdmin] = await Promise.all([tx.get(ref), tx.get(adminRef)]);
        if (!fresh.exists) throw Object.assign(new Error('User not found.'), {status:404});
        const oldAdmin = freshAdmin.exists ? freshAdmin.data() || {} : {};
        const adminPatch = enabled
          ? {
              foundingCoach:true,
              foundingCoachSince:oldAdmin.foundingCoachSince || Timestamp.fromDate(now),
              foundingCoachFreeUntil:Timestamp.fromDate(freeUntil),
              foundingCoachGrantedBy:String(session.email || ADMIN_EMAIL),
              foundingCoachRemovedAt:FieldValue.delete(),
              foundingCoachRemovedBy:FieldValue.delete()
            }
          : {
              foundingCoach:false,
              foundingCoachFreeUntil:FieldValue.delete(),
              foundingCoachRemovedAt:Timestamp.fromDate(now),
              foundingCoachRemovedBy:String(session.email || ADMIN_EMAIL)
            };
        tx.set(adminRef, adminPatch, {merge:true});
        await writeAdminAudit(db, session, {
          action:'user.setFoundingCoach', entityType:'user', entityId:userId,
          before:{
            foundingCoach:oldAdmin.foundingCoach === true,
            foundingCoachSince:iso(oldAdmin.foundingCoachSince),
            foundingCoachFreeUntil:iso(oldAdmin.foundingCoachFreeUntil)
          },
          after:{
            foundingCoach:enabled,
            foundingCoachSince:enabled ? iso(oldAdmin.foundingCoachSince || now) : iso(oldAdmin.foundingCoachSince),
            foundingCoachFreeUntil:enabled ? freeUntil.toISOString() : ''
          },
          requestId:String(body.requestId || '')
        }, tx);
      });
      return res.json({ok:true,user:await readUserDetails(db,userId)});
    } else if (operation === 'setSuspension') {
      if (text(privateData.email, 180).toLowerCase() === ADMIN_EMAIL) {
        return res.status(400).json({ error:'Нельзя ограничить основной аккаунт администратора.' });
      }
      const suspended = body.suspended === true;
      const reason = text(body.reason, 300);
      if (suspended && reason.length < 3) return res.status(400).json({ error:'Укажите причину ограничения.' });
      const previousActiveLooking = adminData.previousActiveLooking ?? (before.activeLooking !== false);
      const userPatch = suspended
        ? { isSuspended:true, activeLooking:false }
        : { isSuspended:false, activeLooking:previousActiveLooking === true };
      const adminPatch = suspended
        ? {
            suspensionReason:reason,
            suspendedAt:new Date().toISOString(),
            suspendedBy:String(session.email || ADMIN_EMAIL),
            previousActiveLooking
          }
        : {
            suspensionReason:'',
            suspendedAt:'',
            suspendedBy:'',
            previousActiveLooking:FieldValue.delete(),
            restoredAt:new Date().toISOString(),
            restoredBy:String(session.email || ADMIN_EMAIL)
          };

      const auth = getAuth();
      const authBefore = await auth.getUser(userId);
      await auth.updateUser(userId, { disabled:suspended });
      try {
        await db.runTransaction(async tx => {
          const [fresh, freshAdmin] = await Promise.all([tx.get(ref), tx.get(adminRef)]);
          if (!fresh.exists) throw Object.assign(new Error('User not found.'), {status:404});
          const old = fresh.data() || {};
          const oldAdmin = freshAdmin.exists ? freshAdmin.data() || {} : {};
          const previousLooking = oldAdmin.previousActiveLooking ?? (old.activeLooking !== false);
          const nextUser = {...userPatch, activeLooking:suspended ? false : previousLooking === true};
          const nextAdmin = suspended ? {...adminPatch, previousActiveLooking:previousLooking} : adminPatch;
          tx.update(ref, nextUser);
          tx.set(adminRef, nextAdmin, {merge:true});
          await writeAdminAudit(db, session, {
            action:'user.setSuspension', entityType:'user', entityId:userId,
            before:{isSuspended:old.isSuspended === true, suspensionReason:text(oldAdmin.suspensionReason,300)},
            after:{isSuspended:suspended, suspensionReason:suspended ? reason : ''},
            requestId:String(body.requestId || '')
          }, tx);
        });
      } catch (error) {
        try {
          await auth.updateUser(userId, {disabled:authBefore.disabled === true});
        } catch (restoreError) {
          console.error('[admin-users] Auth rollback failed', {userId, code:restoreError?.code});
          throw Object.assign(new Error('Изменение не сохранено, восстановить статус входа не удалось. Проверьте аккаунт в Firebase Authentication перед повтором.'), {status:503});
        }
        throw error;
      }
      return res.json({ok:true, user:await readUserDetails(db,userId)});
    } else {
      return res.status(400).json({ error:'Unknown operation.' });
    }
  } catch (error) {
    const status = Number(error?.status || (error?.code === 'auth/user-not-found' ? 404 : 500));
    if (status === 500) console.error('[admin-users]', error);
    return res.status(status).json({ error:status === 500 ? 'User administration failed.' : error.message });
  }
}
