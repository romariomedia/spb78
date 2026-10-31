export function isGroupChatThread(thread={}) {
  return thread?.kind === 'training' || thread?.kind === 'event';
}

/**
 * Removes group chats that the authenticated participant can no longer see.
 *
 * removedIds is used only for server-confirmed Firestore "removed" changes.
 * authoritative=true additionally reconciles stale localStorage entries against
 * a server-backed query snapshot. Direct chats are deliberately preserved:
 * relationship/profile refreshes must not erase real conversations.
 */
export function pruneUnavailableGroupThreads(
  threads={},
  {liveIds=[],removedIds=[],authoritative=false}={}
) {
  const next={...threads};
  const removed=new Set(removedIds);
  const live=new Set(liveIds);

  for(const [id,thread] of Object.entries(next)){
    if(!isGroupChatThread(thread))continue;
    if(authoritative&&(removed.has(id)||!live.has(id)))delete next[id];
  }
  return next;
}

/** Ignore counts from a response older than a realtime message or another read. */
export function mergeChatReadResult(thread,uid,result){
  const previous=Number(thread.readAt?.[uid]||0);
  const readAt=Math.max(previous,Number(result.readAt||0));
  const current=Number.isFinite(result.lastMessageAt)&&
    Number(thread.lastMessageAt||0)<=result.lastMessageAt&&previous<=Number(result.readAt||0);
  return {...thread,
    messages:thread.messages.map(message=>({...message,read:message.senderId===uid||message.timestamp<=readAt})),
    readAt:{...thread.readAt,[uid]:readAt},
    unreadCount:current?{...thread.unreadCount,[uid]:Math.max(0,Number(result.unreadCount||0))}:thread.unreadCount
  };
}
