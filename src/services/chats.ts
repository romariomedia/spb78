import { collection, doc, onSnapshot, query, setDoc, where, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChatMessage, ChatThread, UserProfile } from '../lib/types';
import { CURRENT_USER_ID } from './repository';

const CHATS_STORAGE_KEY = 'sportbuddy_chats_spb_v1';
const WRITE_TIMEOUT_MS = 3500;

// Never block the UI on an unreachable Firestore backend
function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    const timer = setTimeout(() => {}, 0);
    clearTimeout(timer);
    void Promise.race([
      action(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS))
    ]).catch(() => {
      /* offline — local cache is the source of truth */
    });
  } catch {
    /* ignore */
  }
}

export function buildChatId(userA: string, userB: string): string {
  return `chat_${[userA, userB].sort().join('__')}`;
}

function readAllThreads(): Record<string, ChatThread> {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
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
  return Object.values(readAllThreads())
    .filter((thread) => thread.participantIds.includes(userId))
    .filter((thread) => thread.messages.length > 0)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function writeAllThreads(threads: Record<string, ChatThread>): void {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(threads));
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
const SEED_DIALOGS: Record<string, { fromCompanion: boolean; text: string; minutesAgo: number }[]> = {};

function createSeedThread(companion: UserProfile): ChatThread {
  const chatId = buildChatId(CURRENT_USER_ID, companion.id);
  const seed = SEED_DIALOGS[companion.id];
  const now = Date.now();

  const messages: ChatMessage[] = (seed || []).map((entry, idx) => {
    const timestamp = now - entry.minutesAgo * 60000;
    return {
      id: `${chatId}_seed_${idx}`,
      chatId,
      senderId: entry.fromCompanion ? companion.id : CURRENT_USER_ID,
      text: entry.text,
      createdAt: formatTimeLabel(timestamp),
      timestamp,
      read: entry.minutesAgo > 60
    };
  });

  const last = messages[messages.length - 1];

  return {
    id: chatId,
    participantIds: [CURRENT_USER_ID, companion.id],
    companionId: companion.id,
    messages,
    lastMessageAt: last ? last.timestamp : now,
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
  const stored = readAllThreads();
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
    const fresh = createSeedThread(companion);
    stored[chatId] = fresh;
    changed = true;
    return fresh;
  });

  if (changed) writeAllThreads(stored);

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
      const stored = readAllThreads();
      snapshot.docs.forEach((chatDoc) => {
        const data = chatDoc.data() as ChatThread;
        const companionId = data.participantIds.find((id) => id !== currentUser.id);
        if (!companionId) return;
        stored[chatDoc.id] = {
          ...data,
          id: chatDoc.id,
          companionId,
          messages: (data.messages || []).map((message) => ({
            ...message,
            createdAt: formatTimeLabel(message.timestamp)
          }))
        };
      });
      writeAllThreads(stored);

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

export function sendChatMessage(chatId: string, companionId: string, text: string): ChatMessage {
  const threads = readAllThreads();
  const timestamp = Date.now();

  const message: ChatMessage = {
    id: `${chatId}_${timestamp}`,
    chatId,
    senderId: CURRENT_USER_ID,
    text: text.trim(),
    createdAt: 'только что',
    timestamp,
    read: true
  };

  const thread: ChatThread = threads[chatId] || {
    id: chatId,
    participantIds: [CURRENT_USER_ID, companionId],
    companionId,
    messages: [],
    lastMessageAt: timestamp,
    createdAt: new Date(timestamp).toISOString()
  };

  thread.messages = [...thread.messages, message];
  thread.lastMessageAt = timestamp;
  threads[chatId] = thread;
  writeAllThreads(threads);

  backgroundWrite(() => setDoc(doc(db, 'chats', chatId), thread));

  return message;
}

export function markThreadAsRead(chatId: string): void {
  const threads = readAllThreads();
  const thread = threads[chatId];
  if (!thread) return;
  thread.messages = thread.messages.map((m) => ({ ...m, read: true }));
  threads[chatId] = thread;
  writeAllThreads(threads);
}

export function countUnread(threads: ChatThread[]): number {
  return threads.reduce(
    (sum, t) => sum + t.messages.filter((m) => !m.read && m.senderId !== CURRENT_USER_ID).length,
    0
  );
}

/** Auto-reply so the conversation feels alive in the demo/preview build */
export function scheduleCompanionReply(
  chatId: string,
  companion: UserProfile,
  onReply: (message: ChatMessage) => void
): void {
  const replies = [
    'Отлично, я в деле! 💪',
    'Супер! Тогда до встречи на Крестовском 🎾',
    'Договорились, беру ракетки и воду 🚀',
    'Хорошо! Если что — напишу за час до старта ⏰',
    'Класс! Люблю тренироваться в компании 🔥'
  ];
  const text = replies[Math.floor(Math.random() * replies.length)] || replies[0]!;

  setTimeout(() => {
    const threads = readAllThreads();
    const thread = threads[chatId];
    if (!thread) return;

    const timestamp = Date.now();
    const reply: ChatMessage = {
      id: `${chatId}_${timestamp}_r`,
      chatId,
      senderId: companion.id,
      text,
      createdAt: 'только что',
      timestamp,
      read: true
    };
    thread.messages = [...thread.messages, reply];
    thread.lastMessageAt = timestamp;
    threads[chatId] = thread;
    writeAllThreads(threads);
    onReply(reply);
  }, 1400 + Math.random() * 900);
}
