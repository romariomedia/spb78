export function isGroupChatThread(thread={}) {
  return thread?.kind === 'training' || thread?.kind === 'event';
}

/**
 * Removes group chats that the authenticated participant can no longer see.
 *
 * removedIds is used immediately for Firestore "removed" changes.
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
    if(removed.has(id)||(authoritative&&!live.has(id)))delete next[id];
  }
  return next;
}
