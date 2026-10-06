export function assertUserActive(profile) {
  if (profile?.isSuspended === true) {
    throw Object.assign(new Error('Аккаунт временно ограничен администрацией SportBuddy78.'), {
      status: 403,
      code: 'ACCOUNT_SUSPENDED'
    });
  }
}

export async function readUserStatus(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { exists:false, snap, profile:null };
  const profile = snap.data() || {};
  assertUserActive(profile);
  return { exists:true, snap, profile };
}

export async function requireActiveUser(db, uid) {
  const result = await readUserStatus(db, uid);
  if (!result.exists) {
    throw Object.assign(new Error('Профиль не найден'), { status: 404, code: 'PROFILE_NOT_FOUND' });
  }
  return result;
}
