import { collection, onSnapshot, query, where, Unsubscribe } from 'firebase/firestore';
import { callServer } from './serverApi';
import { db } from '../lib/firebase';
import { ChatMessage, ChatThread, UserProfile } from '../lib/types';
import { CURRENT_USER_ID } from './repository';

const CHATS_STORAGE_KEY = 'sportbuddy_chats_spb_v2';
const storageKey = (userId = CURRENT_USER_ID) => `${CHATS_STORAGE_KEY}:${userId || 'anonymous'}`;
export function buildChatId(userA: string, userB: string): string {
  return `chat_${[userA, userB].sort().join('__')}`;
}

function readAllThreads(userId = CURRENT_USER_ID): Record<string, ChatThread> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, ChatThread>) : {};
  } catch {
    return {};
  }
}

/**
 * Returns only conversations where at least one message was exchanged.
 * Used by the safety complaint flow — an athlete cannot report a person they
 * never actually chatted with.
 */
export function getReportableChatThreads(userId: string): ChatThread[] {
  return Object.values(readAllThreads(userId))
    .filter((thread) => thread.participantIds.includes(userId))
    .filter((thread) => thread.messages.length > 0)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function writeAllThreads(threads: Record<string, ChatThread>, userId = CURRENT_USER_ID): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(threads));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearChatCache(userId: string): void {
  try { localStorage.removeItem(storageKey(userId)); } catch { /* storage unavailable */ }
}

export function formatTimeLabel(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}

/**
 * No pre-written conversations: every chat starts empty.
 * A thread is created only after a real mutual like or friendship.
 */
function createEmptyThread(currentUserId: string, companion: UserProfile): ChatThread {
  const chatId = buildChatId(currentUserId, companion.id);
  const now = Date.now();
  return {
    id: chatId,
    participantIds: [currentUserId, companion.id],
    companionId: companion.id,
    messages: [],
    lastMessageAt: now,
    createdAt: new Date(now).toISOString()
  };
}

/**
 * Returns one thread per mutual match OR mutual friend, creating them on first open.
 * Pass `category` to filter: 'matches' | 'friends'.
 */
export function loadChatThreads(
  currentUser: UserProfile,
  allUsers: UserProfile[],
  category: 'matches' | 'friends' = 'matches'
): ChatThread[] {
  const stored = readAllThreads(currentUser.id);
  let changed = false;

  const ids = category === 'friends'
    ? (currentUser.friendIds || [])
    : currentUser.matchIds;

  const matchedCompanions = allUsers.filter(
    (u) => u.id !== currentUser.id && ids.includes(u.id)
  );

  const threads: ChatThread[] = matchedCompanions.map((companion) => {
    const chatId = buildChatId(currentUser.id, companion.id);
    const existing = stored[chatId];
    if (existing) {
      // keep relative time labels fresh
      existing.messages = existing.messages.map((m) => ({ ...m, createdAt: formatTimeLabel(m.timestamp) }));
      existing.companionId = companion.id;
      return existing;
    }
    const fresh = createEmptyThread(currentUser.id, companion);
    stored[chatId] = fresh;
    changed = true;
    return fresh;
  });

  if (changed) writeAllThreads(stored,currentUser.id);

  return threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/**
 * Realtime messages from Firestore. The callback receives only threads from
 * the selected Chats tab (Мэтчи or Друзья); Storage remains an offline cache.
 */
export function subscribeChatThreads(
  currentUser: UserProfile,
  category: 'matches' | 'friends',
  onChange: (threads: ChatThread[]) => void,
  onAllChange?: (threads: ChatThread[]) => void
): Unsubscribe {
  const companionIds = new Set(
    category === 'friends' ? (currentUser.friendIds || []) : currentUser.matchIds
  );

  return onSnapshot(
    query(collection(db, 'chats'), where('participantIds', 'array-contains', currentUser.id)),
    (snapshot) => {
      const stored = readAllThreads(currentUser.id);
      snapshot.docs.forEach((chatDoc) => {
        const data = chatDoc.data() as ChatThread & { readAt?: Record<string, number> };
        const companionId = data.participantIds.find((id) => id !== currentUser.id);
        if (!companionId) return;
        const sourceMessages = data.recentMessages || data.messages || [];
        const merged=new Map<string,ChatMessage>();
        for(const message of stored[chatDoc.id]?.messages||[])merged.set(message.id,message);
        for(const message of sourceMessages)merged.set(message.id,{
          ...message,
          read: message.senderId === currentUser.id || message.timestamp <= (data.readAt?.[currentUser.id] ?? 0),
          createdAt: formatTimeLabel(message.timestamp)
        });
        stored[chatDoc.id] = {
          ...stored[chatDoc.id],
          ...data,
          id: chatDoc.id,
          companionId,
          messages:[...merged.values()].sort((a,b)=>a.timestamp-b.timestamp).slice(-200)
        };
      });
      writeAllThreads(stored,currentUser.id);

      const allThreads = Object.values(stored)
        .filter((thread) => thread.participantIds.includes(currentUser.id))
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      onAllChange?.(allThreads);
      onChange(allThreads.filter((thread) => companionIds.has(thread.companionId)));
    },
    () => {
      // Offline cache remains active; no UI error needed.
    }
  );
}


export async function loadChatHistory(chatId: string, userId: string): Promise<ChatMessage[]> {
  const data=await callServer<{messages:ChatMessage[]}>('/api/sportbuddy-mutation',{action:'chat',operation:'history',chatId});
  const threads=readAllThreads(userId);
  const cached=threads[chatId];
  const readAt=Number(cached?.readAt?.[userId]||0);
  const messages=(Array.isArray(data.messages)?data.messages:[]).map(message=>({
    ...message,
    read:message.senderId===userId||message.timestamp<=readAt,
    createdAt:formatTimeLabel(message.timestamp)
  })).sort((a,b)=>a.timestamp-b.timestamp).slice(-200);
  if(cached){
    threads[chatId]={...cached,messages};
    writeAllThreads(threads,userId);
  }
  return messages;
}

export async function sendChatMessage(chatId: string, companionId: string, text: string): Promise<ChatMessage> {
  const result = await callServer<{message:ChatMessage;thread:ChatThread}>('/api/sportbuddy-mutation', {action:'chat', chatId, companionId, text});
  const threads=readAllThreads(CURRENT_USER_ID); threads[chatId]=result.thread; writeAllThreads(threads,CURRENT_USER_ID); return result.message;
}

export async function markThreadAsRead(chatId: string): Promise<void> {
  const uid = CURRENT_USER_ID;
  const thread = readAllThreads(uid)[chatId];
  if (!thread || !thread.participantIds.includes(uid)) return;
  const result = await callServer<{readAt:number}>('/api/sportbuddy-mutation', {
    action:'chat', operation:'read', chatId, throughTimestamp:thread.lastMessageAt
  });
  if (CURRENT_USER_ID !== uid) return;
  const threads=readAllThreads(uid), latest=threads[chatId];
  if (!latest) return;
  latest.messages=latest.messages.map(message=>({ ...message,
    read:message.senderId===uid || message.timestamp<=result.readAt
  }));
  latest.readAt={...(latest.readAt||{}),[uid]:result.readAt};
  latest.unreadCount={...(latest.unreadCount||{}),[uid]:0};
  writeAllThreads(threads,uid);
}

export function countUnread(threads: ChatThread[]): number {
  return threads.reduce((sum, thread) => {
    const metadata = Number(thread.unreadCount?.[CURRENT_USER_ID]);
    if (Number.isFinite(metadata)) return sum + metadata;
    return sum + thread.messages.filter((m) => !m.read && m.senderId !== CURRENT_USER_ID).length;
  }, 0);
}
