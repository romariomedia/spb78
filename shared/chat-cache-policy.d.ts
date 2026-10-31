export interface CachedChatLike {
  kind?: string;
}

export interface GroupChatPruneOptions {
  liveIds?: string[];
  removedIds?: string[];
  authoritative?: boolean;
}

export function isGroupChatThread(thread?: CachedChatLike): boolean;

export function pruneUnavailableGroupThreads<T extends CachedChatLike>(
  threads: Record<string,T>,
  options?: GroupChatPruneOptions
): Record<string,T>;
