import { UserProfile } from '../lib/types';
import { updateProfile } from './repository';
import { triggerHapticImpact, triggerHapticNotification } from './native';
import {
  sendRealtimeFriendRequest, acceptRealtimeFriendRequest, declineRealtimeFriendRequest
} from './friendRealtime';

const FRIENDS_KEY = 'sportbuddy_friends_spb_v1';

interface FriendsState {
  friendIds: string[];
  sent: string[];
  received: string[];
}

function readState(): FriendsState {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    if (!raw) return { friendIds: [], sent: [], received: [] };
    return JSON.parse(raw) as FriendsState;
  } catch {
    return { friendIds: [], sent: [], received: [] };
  }
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
  const state = readState();
  return {
    ...user,
    friendIds: state.friendIds,
    friendRequestsSent: state.sent,
    friendRequestsReceived: state.received
  };
}

export type FriendStatus = 'none' | 'friends' | 'sent' | 'received';

export function getFriendStatus(user: UserProfile, targetId: string): FriendStatus {
  if ((user.friendIds || []).includes(targetId)) return 'friends';
  if ((user.friendRequestsSent || []).includes(targetId)) return 'sent';
  if ((user.friendRequestsReceived || []).includes(targetId)) return 'received';
  return 'none';
}

async function persist(user: UserProfile, state: FriendsState): Promise<UserProfile> {
  writeState(state);
  const next: UserProfile = {
    ...user,
    friendIds: state.friendIds,
    friendRequestsSent: state.sent,
    friendRequestsReceived: state.received
  };
  await updateProfile({
    friendIds: state.friendIds,
    friendRequestsSent: state.sent,
    friendRequestsReceived: state.received
  });
  return next;
}

export async function sendFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('medium');
  const state = readState();
  if (state.friendIds.includes(targetId) || state.sent.includes(targetId)) return user;

  // If they already invited us → instantly become friends
  if (state.received.includes(targetId)) {
    state.received = state.received.filter((id) => id !== targetId);
    state.friendIds = [...state.friendIds, targetId];
    triggerHapticNotification('success');
    acceptRealtimeFriendRequest(targetId, user.id);
    return persist(user, state);
  }

  state.sent = [...state.sent, targetId];
  sendRealtimeFriendRequest(user.id, targetId);
  return persist(user, state);
}

export async function acceptFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticNotification('success');
  const state = readState();
  state.received = state.received.filter((id) => id !== targetId);
  if (!state.friendIds.includes(targetId)) state.friendIds = [...state.friendIds, targetId];
  acceptRealtimeFriendRequest(targetId, user.id);
  return persist(user, state);
}

export async function declineFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('light');
  const state = readState();
  state.received = state.received.filter((id) => id !== targetId);
  declineRealtimeFriendRequest(targetId, user.id);
  return persist(user, state);
}

export async function removeFriend(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('medium');
  const state = readState();
  state.friendIds = state.friendIds.filter((id) => id !== targetId);
  state.sent = state.sent.filter((id) => id !== targetId);
  return persist(user, state);
}

export async function cancelFriendRequest(user: UserProfile, targetId: string): Promise<UserProfile> {
  triggerHapticImpact('light');
  const state = readState();
  state.sent = state.sent.filter((id) => id !== targetId);
  return persist(user, state);
}

export function getFriends(user: UserProfile, allUsers: UserProfile[]): UserProfile[] {
  const ids = user.friendIds || [];
  return allUsers.filter((u) => ids.includes(u.id));
}

export function getIncomingRequests(user: UserProfile, allUsers: UserProfile[]): UserProfile[] {
  const ids = user.friendRequestsReceived || [];
  return allUsers.filter((u) => ids.includes(u.id));
}
