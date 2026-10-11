/*
 * screen.js — the fullscreen plate, outermost in the corner (#corner).
 *
 * SELF-CONTAINED: imports nothing, exports nothing, loaded as its own module
 * so a maze that fails to boot still keeps the button that makes it bigger.
 * NOT NAMED fullscreen.js — a default uBlock list bans that basename across
 * github.io, and one blocked file is a blank game (hub CLAUDE.md §2).
 *
 * Shown only once a working request/exit pair answers: iPhone Safari has no
 * element fullscreen, and a button that does nothing is worse than none. The
 * label and aria-pressed are repainted from fullscreenchange, because Escape
 * and the browser's own chrome leave fullscreen without touching the button,
 * and CSS swaps the glyph off the same aria-pressed so the two cannot drift.
 *
 * NO ORIENTATION LOCK. The hub suggests pairing one with fullscreen on a
 * phone, but MiniMaze has no right way up: main.js turns a maze 90° to fill
 * whichever screen it is on, and tilt is re-zeroed when the device turns.
 */

const button = document.getElementById('screen-toggle');
const root = document.documentElement;
const request = root.requestFullscreen || root.webkitRequestFullscreen || null;
const exit = document.exitFullscreen || document.webkitExitFullscreen || null;

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/* Its own two words per language: this file imports nothing, js/i18n.js included. */
const WORDS = {
  nb: ['Fullskjerm', 'Avslutt fullskjerm'],
  en: ['Fullscreen', 'Exit fullscreen'],
};

function paint() {
  const active = isFullscreen();
  const words = WORDS[document.documentElement.lang] || WORDS.nb;
  const label = active ? words[1] : words[0];
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', label);
  button.title = label;
}

if (button && request && exit) {
  button.hidden = false;
  paint();
  button.addEventListener('click', () => {
    // Either call may return a promise that a permissions policy or a
    // declined prompt rejects; fullscreenchange reports what really
    // happened, so the rejection is swallowed rather than reaching the
    // crash bar.
    try {
      const result = isFullscreen() ? exit.call(document) : request.call(root);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      // An old engine that throws instead: nothing changed, nothing to say.
    }
  });
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  // js/i18n.js announces a language switch; repaint the label in the new one.
  document.addEventListener('arcade:lang', paint);
}
