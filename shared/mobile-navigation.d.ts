export const MOBILE_TABS: readonly ['discover', 'trainings', 'leisure', 'chats', 'feed', 'profile'];
export function swipeStep(dx: number, dy: number, elapsed: number): number;
export function createBackStack(): { add(close: () => void): () => void; hasLayers(): boolean; closeTop(): boolean };
