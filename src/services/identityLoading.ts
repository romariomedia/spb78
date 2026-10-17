import type {ChatThread, UserProfile} from '../lib/types';

/** Stable identity set: repeated messages from known authors do not trigger reads. */
export function socialIdentityKey(user: UserProfile | null, threads: ChatThread[], openChatId: string | null, includeReportContacts = false): string {
  if (!user) return '[]';
  const ids = new Set<string>();
  const add = (id: unknown) => {
    if (typeof id === 'string' && id && id !== user.id && id.length <= 128 && !id.includes('/')) ids.add(id);
  };
  for (const list of [user.friendIds, user.matchIds, user.friendRequestsReceived, user.friendRequestsSent])
    if (Array.isArray(list)) list.forEach(add);
  for (const thread of threads) {
    if (!thread.participantIds?.includes(user.id)) continue;
    add(thread.companionId);
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    add(messages.at(-1)?.senderId);
    if (thread.id === openChatId || (includeReportContacts && messages.length > 0)) {
      thread.participantIds.forEach(add);
      if (thread.id === openChatId) {
        // Former group members may still have visible messages in history.
        messages.forEach(message => add(message.senderId));
        Object.keys(thread.typingAt || {}).forEach(add);
      }
    }
  }
  return JSON.stringify([...ids].sort());
}
