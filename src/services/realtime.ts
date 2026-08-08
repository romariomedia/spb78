import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Minimal invalidation listeners. Existing repository remains the normalizer
 * and cache owner; snapshots only tell App when to refresh its local mirror.
 */
export function subscribeAppInvalidation(onInvalidate: () => void): Unsubscribe {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onInvalidate, 350);
  };

  const stops = [
    onSnapshot(collection(db, 'users'), schedule, () => undefined),
    onSnapshot(collection(db, 'trainings'), schedule, () => undefined),
    onSnapshot(collection(db, 'feed'), schedule, () => undefined)
  ];

  return () => {
    if (timer) clearTimeout(timer);
    stops.forEach((stop) => stop());
  };
}