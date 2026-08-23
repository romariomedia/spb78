/**
 * Authoritative local record of trainings that the signed-in athlete actually
 * joined. It fixes legacy/shared-cache participantIds from before account
 * isolation was introduced.
 */

// v2 invalidates stale memberships recorded before account isolation.
const KEY_PREFIX = 'sportbuddy_training_memberships_v2_';

function key(accountId: string): string {
  return `${KEY_PREFIX}${accountId}`;
}

export function getJoinedTrainingIds(accountId: string | undefined): Set<string> {
  if (!accountId) return new Set();
  try {
    const raw = localStorage.getItem(key(accountId));
    const values = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function setJoinedTraining(accountId: string | undefined, trainingId: string, joined: boolean): void {
  if (!accountId) return;
  const ids = getJoinedTrainingIds(accountId);
  if (joined) ids.add(trainingId);
  else ids.delete(trainingId);
  try {
    localStorage.setItem(key(accountId), JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

export function clearJoinedTrainings(accountId: string | undefined): void {
  if (!accountId) return;
  try { localStorage.removeItem(key(accountId)); } catch { /* ignore */ }
}