import { UserProfile } from '../lib/types';
import { callServer } from './serverApi';
import { triggerHapticImpact, triggerHapticNotification } from './native';
const FRIENDS_KEY = 'sportbuddy_friends_spb_v1';

interface FriendsState {
  friendIds: string[];
  sent: string[];
  received: string[];
}

function writeState(state: FriendsState): void {
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

/**
 * Loads the friend graph for the signed-in athlete.
 * A new account always starts with an empty list — no pre-seeded friends,
 * so the profile counter reflects real connections only.
 */
export function initFriendsState(user: UserProfile, _allUsers: UserProfile[]): UserProfile {
  // Firestore/Vercel is authoritative. localStorage is only an offline cache.
  writeState({ friendIds:user.friendIds || [], sent:user.friendRequestsSent || [], received:user.friendRequestsReceived || [] });
  return user;
}

export type FriendStatus = 'none' | 'friends' | 'sent' | 'received';

export function getFriendStatus(user: UserProfile, targetId: string): FriendStatus {
  if ((user.friendIds || []).includes(targetId)) return 'friends';
  if ((user.friendRequestsSent || []).includes(targetId)) return 'sent';
  if ((user.friendRequestsReceived || []).includes(targetId)) return 'received';
  return 'none';
}

async function persist(user: UserProfile, operation: 'send'|'accept'|'decline'|'cancel'|'remove', targetId: string): Promise<UserProfile> {
  const result = await callServer<{friendIds:string[];friendRequestsSent:string[];friendRequestsReceived:string[]}>('/api/sportbuddy-mutation', {action:'friend', operation, targetUserId:targetId});
  writeState({friendIds:result.friendIds||[],sent:result.friendRequestsSent||[],received:result.friendRequestsReceived||[]});
  return {...user, friendIds:result.friendIds||[], friendRequestsSent:result.friendRequestsSent||[], friendRequestsReceived:result.friendRequestsReceived||[]};
}

export async function sendFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('medium'); const next=await persist(user,'send',targetId); triggerHapticNotification('success'); return next;
}
export async function acceptFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticNotification('success'); return persist(user,'accept',targetId);
}
export async function declineFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('light'); return persist(user,'decline',targetId);
}
export async function removeFriend(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('medium'); return persist(user,'remove',targetId);
}
export async function cancelFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('light'); return persist(user,'cancel',targetId);
}

export function getFriends(user: UserProfile, allUsers: UserProfile[]): UserProfile[] {
  const ids = user.friendIds || [];
  return allUsers.filter((u) => ids.includes(u.id));
}

export function getIncomingRequests(user: UserProfile, allUsers: UserProfile[]): UserProfile[] {
  const ids = user.friendRequestsReceived || [];
  return allUsers.filter((u) => ids.includes(u.id));
}
