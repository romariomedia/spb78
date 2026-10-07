export const CHAT_RECENT_LIMIT = 60;
export const CHAT_MESSAGE_MAX = 2000;
export const CHAT_RATE_LIMIT_MS = 350;
export const CHAT_DELETE_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_REPLY_PREVIEW_MAX = 180;

export function buildServerChatId(userA, userB) {
  return `chat_${[String(userA), String(userB)].sort().join('__')}`;
}

export function sanitizeChatText(value) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (!text || text.length > CHAT_MESSAGE_MAX) {
    throw Object.assign(new Error('Некорректное сообщение'), { status: 400 });
  }
  return text;
}

export function assertChatParticipants({ uid, companionId, chatId }) {
  if (!uid || !companionId || uid === companionId) {
    throw Object.assign(new Error('Некорректный пользователь'), { status: 400 });
  }
  if (chatId !== buildServerChatId(uid, companionId)) {
    throw Object.assign(new Error('Некорректный идентификатор чата'), { status: 400 });
  }
}

export function assertChatRelationship(me = {}, other = {}, companionId, uid) {
  if (me.isSuspended === true || other.isSuspended === true) {
    throw Object.assign(new Error('Чат с этим пользователем временно недоступен'), { status: 403 });
  }
  const mineBlocked = Array.isArray(me.blockedUserIds) ? me.blockedUserIds : [];
  const otherBlocked = Array.isArray(other.blockedUserIds) ? other.blockedUserIds : [];
  if (mineBlocked.includes(companionId) || otherBlocked.includes(uid)) {
    throw Object.assign(new Error('Общение с этим пользователем недоступно'), { status: 403 });
  }
  const myMatches = Array.isArray(me.matchIds) ? me.matchIds : [];
  const otherMatches = Array.isArray(other.matchIds) ? other.matchIds : [];
  const myFriends = Array.isArray(me.friendIds) ? me.friendIds : [];
  const otherFriends = Array.isArray(other.friendIds) ? other.friendIds : [];
  const matched = myMatches.includes(companionId) && otherMatches.includes(uid);
  const friends = myFriends.includes(companionId) && otherFriends.includes(uid);
  if (!matched && !friends) {
    throw Object.assign(new Error('Чат доступен после взаимного мэтча или дружбы'), { status: 403 });
  }
  return { matched, friends };
}

export function nextChatTimestamp(lastMessageAt, now = Date.now()) {
  return Math.max(Number(now) || 0, Number(lastMessageAt || 0) + 1);
}

export function assertChatRateLimit(thread = {}, uid, now = Date.now()) {
  const last = Number(thread.lastSenderAt?.[uid] || 0);
  if (last > 0 && now - last < CHAT_RATE_LIMIT_MS) {
    throw Object.assign(new Error('Сообщения отправляются слишком быстро'), { status: 429, code: 'CHAT_RATE_LIMIT' });
  }
}

export function buildRecentMessages(thread = {}, message) {
  const existing = Array.isArray(thread.recentMessages)
    ? thread.recentMessages
    : Array.isArray(thread.messages) ? thread.messages : [];
  return [...existing, message].slice(-CHAT_RECENT_LIMIT);
}

export function nextUnreadCounts(thread = {}, senderId, recipientId) {
  const current = thread.unreadCount && typeof thread.unreadCount === 'object' ? thread.unreadCount : {};
  return {
    ...current,
    [senderId]: Number(current[senderId] || 0),
    [recipientId]: Math.min(999, Number(current[recipientId] || 0) + 1)
  };
}


export function assertMessageDeleteAllowed(message = {}, uid, now = Date.now()) {
  if (!message?.id || message.senderId !== uid) {
    throw Object.assign(new Error('Удалить можно только своё сообщение'), { status: 403 });
  }
  if (message.deletedAt) {
    throw Object.assign(new Error('Сообщение уже удалено'), { status: 409 });
  }
  const timestamp = Number(message.timestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || now - timestamp > CHAT_DELETE_WINDOW_MS) {
    throw Object.assign(new Error('Удалить сообщение можно в течение 15 минут'), { status: 409 });
  }
}

export function replyPreview(message = {}) {
  if (!message?.id || message.deletedAt) {
    throw Object.assign(new Error('Сообщение для ответа недоступно'), { status: 409 });
  }
  return {
    messageId: String(message.id),
    senderId: String(message.senderId || ''),
    text: String(message.text || '').trim().slice(0, CHAT_REPLY_PREVIEW_MAX)
  };
}

export function tombstoneMessage(message = {}, uid, now = Date.now()) {
  return {
    ...message,
    text: 'Сообщение удалено',
    deletedAt: now,
    deletedBy: uid
  };
}
