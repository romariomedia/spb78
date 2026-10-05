import { collection, onSnapshot, query, where, type Query, type QuerySnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FriendRequestRecord {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

// Listener errors are not empty collections. Preserve the last successful state,
// expose the connection issue, and reattach because Firestore stops on fatal errors.
function listen(ref: Query, callback: (snapshot: QuerySnapshot) => void, onError?: (failed: boolean) => void): Unsubscribe {
  let stopped = false;
  let unsubscribe: Unsubscribe = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (stopped) return;
    unsubscribe = onSnapshot(ref, {includeMetadataChanges: true}, snapshot => {
      if (stopped || snapshot.metadata.fromCache) return;
      onError?.(false);
      callback(snapshot);
    }, () => {
      if (stopped) return;
      onError?.(true);
      timer = setTimeout(connect, 15000);
    });
  };
  connect();
  return () => { stopped = true; clearTimeout(timer); unsubscribe(); };
}

function subscribeRequests(userId: string, direction: 'toId' | 'fromId', callback: (requests: FriendRequestRecord[]) => void, onError?: (failed: boolean) => void): Unsubscribe {
  return listen(query(collection(db, 'friendRequests'), where(direction, '==', userId)), snapshot => {
    callback(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as FriendRequestRecord))
      .filter(item => item.status === 'pending').sort((a, b) => b.createdAt - a.createdAt));
  }, onError);
}
export const subscribeIncomingFriendRequests = (userId: string, callback: (requests: FriendRequestRecord[]) => void, onError?: (failed: boolean) => void) => subscribeRequests(userId, 'toId', callback, onError);
export const subscribeOutgoingFriendRequests = (userId: string, callback: (requests: FriendRequestRecord[]) => void, onError?: (failed: boolean) => void) => subscribeRequests(userId, 'fromId', callback, onError);

export function subscribeFriendships(userId: string, callback: (friendIds: string[]) => void, onError?: (failed: boolean) => void): Unsubscribe {
  return listen(query(collection(db, 'friendships'), where('participantIds', 'array-contains', userId)), snapshot => {
    const ids = snapshot.docs.flatMap(item => (item.data().participantIds || []).filter((id: string) => id !== userId));
    callback([...new Set<string>(ids)]);
  }, onError);
}
