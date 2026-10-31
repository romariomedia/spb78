export interface CachedChatLike {
  id?: string;
  kind?: string;
  participantIds?: string[];
  [key:string]: unknown;
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
