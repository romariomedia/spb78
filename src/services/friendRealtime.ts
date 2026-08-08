import { collection, doc, onSnapshot, query, setDoc, updateDoc, where, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FriendRequestRecord {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

function requestId(fromId: string, toId: string): string {
  return `${fromId}__${toId}`;
}

export function sendRealtimeFriendRequest(fromId: string, toId: string): void {
  const payload: FriendRequestRecord = {
    id: requestId(fromId, toId),
    fromId,
    toId,
    status: 'pending',
    createdAt: Date.now()
  };
  void setDoc(doc(db, 'friendRequests', payload.id), payload).catch(() => {});
}

export function acceptRealtimeFriendRequest(fromId: string, toId: string): void {
  const friendshipId = [fromId, toId].sort().join('__');
  void Promise.all([
    updateDoc(doc(db, 'friendRequests', requestId(fromId, toId)), { status: 'accepted' }),
    setDoc(doc(db, 'friendships', friendshipId), {
      participantIds: [fromId, toId],
      createdAt: Date.now()
    })
  ]).catch(() => {});
}

export function declineRealtimeFriendRequest(fromId: string, toId: string): void {
  void updateDoc(doc(db, 'friendRequests', requestId(fromId, toId)), { status: 'declined' }).catch(() => {});
}

export function subscribeIncomingFriendRequests(
  userId: string,
  callback: (requests: FriendRequestRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'friendRequests'), where('toId', '==', userId)),
    (snapshot) => {
      callback(snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Omit<FriendRequestRecord, 'id'>) }))
        .filter((item) => item.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt));
    },
    () => callback([])
  );
}

export function subscribeFriendships(
  userId: string,
  callback: (friendIds: string[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'friendships'), where('participantIds', 'array-contains', userId)),
    (snapshot) => {
      const friendIds = snapshot.docs.flatMap((item) => {
        const ids = (item.data().participantIds || []) as string[];
        return ids.filter((id) => id !== userId);
      });
      callback([...new Set(friendIds)]);
    },
    () => callback([])
  );
}