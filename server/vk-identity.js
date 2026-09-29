// VK identity is established by the server-verified VK ID, never a client email.
export function normalizeVkEmail(value) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export async function resolveVkIdentity({ auth, vkId, mappedUid, profileUids, name, avatar }) {
  if (!/^[1-9]\d*$/.test(vkId)) throw new Error('Invalid verified VK ID');
  if (mappedUid) return { user: await auth.getUser(mappedUid), isNewAccount: false };
  const unique = [...new Set(profileUids)];
  // Ambiguous legacy identities require a separate migration, not deletion at login.
  if (unique.length > 1) throw new Error('Ambiguous legacy VK identities');
  if (unique.length === 1) return { user: await auth.getUser(unique[0]), isNewAccount: false };
  const uid = `vk_${vkId}`;
  try {
    return { user: await auth.getUser(uid), isNewAccount: false };
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  let photoURL;
  try {
    const url = new URL(avatar);
    if (url.protocol === 'https:' || url.protocol === 'http:') photoURL = url.href;
  } catch { /* VK photos are optional. */ }
  try {
    // Email is optional in VK. Do not invent addresses or implicitly link accounts.
    const user = await auth.createUser({ uid, displayName: String(name).slice(0, 128), ...(photoURL ? { photoURL } : {}) });
    return { user, isNewAccount: true };
  } catch (error) {
    if (error.code !== 'auth/uid-already-exists') throw error;
    return { user: await auth.getUser(uid), isNewAccount: false };
  }
}
