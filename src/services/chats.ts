import { collection, limit, onSnapshot, orderBy, query, where, Unsubscribe } from 'firebase/firestore';
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
  onChange: (threads: ChatThread[]) => void
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
        stored[chatDoc.id] = {
          ...data,
          id: chatDoc.id,
          companionId,
          messages: sourceMessages.map((message) => ({
            ...message,
            read: message.senderId === currentUser.id || message.timestamp <= (data.readAt?.[currentUser.id] ?? 0),
            createdAt: formatTimeLabel(message.timestamp)
          }))
        };
      });
      writeAllThreads(stored,currentUser.id);

      const threads = Object.values(stored)
        .filter((thread) => thread.participantIds.includes(currentUser.id))
        .filter((thread) => companionIds.has(thread.companionId))
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      onChange(threads);
    },
    () => {
      // Offline cache remains active; no UI error needed.
    }
  );
}


/**
 * Subscribes to message history for one opened conversation.
 * New chat storage keeps messages in a subcollection so the chat metadata
 * document stays bounded. Legacy messages from the thread are merged in.
 */
export function subscribeChatMessages(
  chatId: string,
  userId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError?: (failed: boolean) => void
): Unsubscribe {
  const cached = readAllThreads(userId)[chatId];
  const legacy = cached?.messages || [];
  return onSnapshot(
    query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'desc'), limit(200)),
    (snapshot) => {
      onError?.(false);
      const readAt = Number(readAllThreads(userId)[chatId]?.readAt?.[userId] || cached?.readAt?.[userId] || 0);
      const merged = new Map<string, ChatMessage>();
      for (const message of legacy) merged.set(message.id, message);
      for (const doc of snapshot.docs) {
        const message = doc.data() as ChatMessage;
        merged.set(doc.id, {
          ...message,
          id: doc.id,
          read: message.senderId === userId || message.timestamp <= readAt,
          createdAt: formatTimeLabel(message.timestamp)
        });
      }
      const messages=[...merged.values()].sort((a,b)=>a.timestamp-b.timestamp).slice(-200);
      const threads=readAllThreads(userId);
      if(threads[chatId]){
        threads[chatId]={...threads[chatId],messages};
        writeAllThreads(threads,userId);
      }
      onChange(messages);
    },
    () => onError?.(true)
  );
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
