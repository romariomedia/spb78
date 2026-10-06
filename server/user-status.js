export function assertUserActive(profile) {
  if (profile?.isSuspended === true) {
    throw Object.assign(new Error('Аккаунт временно ограничен администрацией SportBuddy78.'), {
      status: 403,
      code: 'ACCOUNT_SUSPENDED'
    });
  }
}

export async function requireActiveUser(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw Object.assign(new Error('Профиль не найден'), { status: 404, code: 'PROFILE_NOT_FOUND' });
  }
  const profile = snap.data() || {};
  assertUserActive(profile);
  return { snap, profile };
}
