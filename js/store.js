/*
 * store.js — which mazes are done, and the best time on each.
 *
 * One key, `minimaze.progress.v1` (hub §6), holding { best: { <name>: s } }.
 * Keyed by maze NAME, not position, so adding or reordering levels never
 * moves a tick onto the wrong maze. Renaming a maze does lose its tick;
 * that is the cheaper failure.
 *
 * localStorage is one namespace shared by every game on the origin and
 * anything may have written there, so every read and write is in try/catch,
 * and a value that is not a finite positive number is ignored on load.
 * Private mode or a full quota just means progress is not kept.
 */

const KEY = 'minimaze.progress.v1';
let best = {};

try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (raw && typeof raw.best === 'object' && raw.best) {
    for (const [name, t] of Object.entries(raw.best)) {
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) best[name] = t;
    }
  }
} catch {
  best = {};
}

export function bestTime(name) {
  return best[name] ?? null;
}

/* Record a finish. Returns true if it is a new best (or the first). */
export function finish(name, seconds) {
  const prev = best[name];
  if (prev != null && prev <= seconds) return false;
  best[name] = seconds;
  try {
    localStorage.setItem(KEY, JSON.stringify({ best }));
  } catch {
    /* not kept this time; the game goes on */
  }
  return true;
}
