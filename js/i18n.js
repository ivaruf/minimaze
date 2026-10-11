/*
 * i18n.js — which language MiniMaze speaks, and every word it says.
 *
 * The hub's contract (CLAUDE.md §2, "Two languages, Norwegian first"):
 * bokmål and English, Norwegian by default whatever the browser prefers,
 * one choice for the whole arcade stored as `arcade.lang.v1`, switched live
 * from a row on the title card and in the menu panel. kitchens/js/i18n.js
 * worked the mechanism out; this is the same shape without its browser
 * sniffing and its own key.
 *
 *   t(key, ...args)     the current language, else English, else the key
 *                       itself (warning once per missing key)
 *   getLang()           "nb" | "en"
 *   setLang(lang)       validate, store, set <html lang>, repaint, then
 *                       dispatch `arcade:lang` on document
 *   paintStatic(root)   [data-i18n] -> textContent,
 *                       [data-i18n-label] -> aria-label and title,
 *                       [data-i18n-aria] -> aria-label only
 *
 * MAZE NAMES. Each maze's English name in js/levels.js is also the key its
 * best time is stored under (js/store.js), so it can never change; the
 * player sees mazeName(name), which looks it up here as `maze.<name>`.
 *
 * js/update.js is self-contained and imports nothing, this file included:
 * it keeps its own few words and listens for `arcade:lang`. So does the
 * crash bar's inline script in index.html.
 */

const KEY = 'arcade.lang.v1';

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'nb' || saved === 'en') return saved;
  } catch {
    // No storage: the default stands.
  }
  return 'nb';
}

let lang = initial();
document.documentElement.lang = lang;

export const getLang = () => lang;

const STRINGS = {
  nb: {
    'board.label': 'Labyrintbrettet',
    'menu': 'Meny',
    'settings': 'Innstillinger',
    'music': 'Musikk',
    'sfx': 'Effekter',
    'sound.silent': 'MiniMaze har ingen lyd ennå. Nivåene blir husket til den kommer.',
    'mute': 'Lyd av',
    'unmute': 'Lyd på',
    'start.tag': 'Vipp brettet. Pass deg for hullene.',
    'play': 'Spill',
    'pick': 'Velg nivå',
    'back': 'Tilbake',
    'paused': 'Pause',
    'pause.tag': 'Kula venter der du forlot den.',
    'resume': 'Fortsett',
    'calibrate': 'Nullstill tiltingen',
    'restart': 'Start på nytt',
    'clear.title': 'I mål!',
    'clear.time': (time) => `Trillet i mål på ${time}`,
    'clear.newBest': 'Ny rekord!',
    'clear.best': (time) => `Rekorden er ${time}`,
    'next': 'Neste nivå',
    'fromStart': 'Fra begynnelsen',
    'nogl.title': 'Ingen 3D her',
    'nogl.body':
      'Denne nettleseren klarer ikke å tegne brettet (WebGL er slått av eller mangler). Prøv en annen nettleser, eller slå på maskinvareakselerasjon igjen.',
    'language': 'Språk',
    'exit.arcade': 'Tilbake til arkaden',
    'exit.close': 'Lukk',
    'exit.refused': 'Lukk vinduet selv',
    'level.plate': (n, name) => `${n}. ${name}`,
    'tile.label': (n, name, time) => `Nivå ${n}, ${name}` + (time ? `, klart på ${time}` : ''),
    'hint.device': 'Vipp for å trille kula. Hold brettet slik du vil – da er det flatt.',
    'hint.drag': 'Dra for å vippe brettet.',
    'hint.keys': 'Piltastene vipper brettet.',
    'maze.Roll': 'Trill',
    'maze.Zigzag': 'Sikksakk',
    'maze.Mind the gap': 'Pass deg for hullet',
    'maze.Stepping stones': 'Steinbro',
    'maze.Long way round': 'Den lange veien',
    'maze.Snail shell': 'Sneglehus',
    'maze.Hop': 'Hopp',
    'maze.Hopscotch': 'Paradis',
    'maze.Over the river': 'Over elva',
    'maze.Long shot': 'Langt skudd',
    'maze.Merry-go-round': 'Karusell',
    'maze.Gearbox': 'Girkasse',
    'maze.Switchback': 'Hårnålssvinger',
    'maze.Lock and key': 'Lås og nøkkel',
    'maze.Flip flop': 'Fram og tilbake',
    'maze.Roundabout': 'Rundkjøring',
    'maze.Clockwork': 'Urverk',
    'maze.Grand tour': 'Den store runden',
  },
  en: {
    'board.label': 'The maze board',
    'menu': 'Menu',
    'settings': 'Settings',
    'music': 'Music',
    'sfx': 'Effects',
    'sound.silent': 'MiniMaze has no sound yet. The levels are kept for when it does.',
    'mute': 'Mute',
    'unmute': 'Unmute',
    'start.tag': 'Tilt the board. Mind the holes.',
    'play': 'Play',
    'pick': 'Pick a level',
    'back': 'Back',
    'paused': 'Paused',
    'pause.tag': 'The marble waits where you left it.',
    'resume': 'Resume',
    'calibrate': 'Reset the tilt',
    'restart': 'Restart',
    'clear.title': 'Home!',
    'clear.time': (time) => `Rolled in ${time}`,
    'clear.newBest': 'A new best!',
    'clear.best': (time) => `Best so far ${time}`,
    'next': 'Next level',
    'fromStart': 'From the start',
    'nogl.title': 'No 3D here',
    'nogl.body':
      'This browser will not draw the board (WebGL is off or missing). Try another browser, or turn hardware acceleration back on.',
    'language': 'Language',
    'exit.arcade': 'Back to arcade',
    'exit.close': 'Close',
    'exit.refused': 'Close this window yourself',
    'level.plate': (n, name) => `${n}. ${name}`,
    'tile.label': (n, name, time) => `Level ${n}, ${name}` + (time ? `, done in ${time}` : ''),
    'hint.device': 'Tilt to roll. Hold it however you like: that is level.',
    'hint.drag': 'Drag to tilt the board.',
    'hint.keys': 'Arrows tilt the board.',
    // English maze names are the names in js/levels.js; mazeName() falls
    // back to them, so none are repeated here.
  },
};

const warned = new Set();

export function t(key, ...args) {
  let v = STRINGS[lang][key];
  if (v === undefined) v = STRINGS.en[key];
  if (v === undefined) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`MiniMaze: no words for "${key}"`);
    }
    return key;
  }
  return typeof v === 'function' ? v(...args) : v;
}

/** A maze's name for the player; `name` is the English one from levels.js. */
export function mazeName(name) {
  if (lang === 'en') return name;
  return STRINGS[lang][`maze.${name}`] ?? name;
}

export function paintStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-label]')) {
    const s = t(el.dataset.i18nLabel);
    el.setAttribute('aria-label', s);
    el.title = s;
  }
  // aria-label alone, for the board itself: a tooltip over the whole
  // canvas would follow the pointer around the maze.
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  // The language buttons: the chosen one is pressed, wherever it appears.
  for (const b of root.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
}

export function setLang(next) {
  if (next !== 'nb' && next !== 'en') return;
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered; this visit still switches.
  }
  paintStatic();
  document.dispatchEvent(new CustomEvent('arcade:lang', { detail: lang }));
}
