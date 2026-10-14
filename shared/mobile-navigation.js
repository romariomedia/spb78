export const MOBILE_TABS = ['discover', 'trainings', 'leisure', 'chats', 'feed', 'profile'];
export function swipeStep(dx, dy, elapsed) {
  if (elapsed > 650 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.8) return 0;
  return dx < 0 ? 1 : -1;
}
export function createBackStack() {
  const layers = [];
  return {
    add(close) {
      const entry = { close };
      layers.push(entry);
      return () => { const i = layers.indexOf(entry); if (i >= 0) layers.splice(i, 1); };
    },
    hasLayers: () => layers.length > 0,
    closeTop() {
      const top = layers.at(-1);
      if (!top) return false;
      top.close(); // A busy editor may consume Back without closing.
      return true;
    }
  };
}
