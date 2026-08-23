import { collection, onSnapshot, query, where, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FriendRequestRecord {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
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