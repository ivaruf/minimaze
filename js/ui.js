/*
 * ui.js — the cards, the maze picker, the HUD and the hint line.
 *
 * Every card is a wooden panel cut from the board's own plank: main.js
 * paints the wood once (render/board-mesh.js) and hands the canvases over
 * as data URLs, which style.css reads through --wood-light / --wood-dark.
 * This file only decides what is showing and what the words say.
 *
 *   start   the title, Play (the next unfinished maze), Pick a level, and
 *           the language row
 *   picker  every maze as a numbered tile, ticked once finished; none are
 *           locked (DESIGN.md §5: no locked doors)
 *   pause   behind the menu plate: resume, restart, pick a level, "reset
 *           the tilt" when device tilt is live, and the language row. Solo
 *           game, so the menu pauses (hub §2).
 *   clear   "Home!", the time, a new-best line, next level / pick a level
 *
 * The menu words are the hub's shared glossary (§2, "Menus speak plainly"),
 * in both languages through js/i18n.js; the game's own voice stays in the
 * taglines, the hints and the "Home!" on the clear card.
 *
 * LANGUAGE IS LIVE. A tap on either flag repaints every card, the HUD plate,
 * the picker and a hint still showing, in place: nothing is hidden, shown,
 * paused or unpaused by it, so the pause card stays open over the same
 * marble. What a card shows that is built from data (the clear card's
 * time, the plate's maze name) is kept as its inputs and re-rendered.
 *
 * The hub's corner (sound and fullscreen beside the menu plate), the volume
 * panel and the way back to the arcade arrive with the M2 menu floor.
 */

import { bestTime } from './store.js';
import { t, mazeName, setLang, paintStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function createUI({ levels, onPlay, onResume, onRestart, onCalibrate, onPause }) {
  const cards = {
    start: $('start'),
    picker: $('picker'),
    pause: $('pause'),
    clear: $('clear'),
  };
  const hud = $('hud');
  const levelName = $('level-name');
  const menuBtn = $('menu-btn');
  const hint = $('hint');
  const tiles = $('picker-tiles');
  let pickerBack = 'start'; // which card the picker's Back returns to

  function show(name) {
    for (const [k, el] of Object.entries(cards)) el.hidden = k !== name;
    hud.hidden = name === 'start' || name === 'picker';
    const first = name && cards[name].querySelector('button:not([hidden])');
    if (first) first.focus({ preventScroll: true });
  }

  function nextUnfinished() {
    const i = levels.findIndex((l) => bestTime(l.name) == null);
    return i < 0 ? 0 : i;
  }

  function fillPicker() {
    tiles.textContent = '';
    levels.forEach((l, i) => {
      const best = bestTime(l.name);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile' + (best != null ? ' done' : '');
      b.innerHTML = `<span class="n">${i + 1}</span>`;
      b.title = mazeName(l.name);
      b.setAttribute('aria-label', t('tile.label', i + 1, mazeName(l.name), best != null ? formatTime(best) : ''));
      b.addEventListener('click', () => onPlay(i));
      tiles.appendChild(b);
    });
  }

  function openPicker(from) {
    pickerBack = from;
    fillPicker();
    show('picker');
  }

  $('start-go').addEventListener('click', () => onPlay(nextUnfinished()));
  $('start-pick').addEventListener('click', () => openPicker('start'));
  $('picker-back').addEventListener('click', () => show(pickerBack));
  $('pause-resume').addEventListener('click', onResume);
  $('pause-restart').addEventListener('click', onRestart);
  $('pause-pick').addEventListener('click', () => openPicker('pause'));
  $('pause-level').addEventListener('click', () => {
    onCalibrate();
    onResume();
  });
  $('clear-next').addEventListener('click', () => onPlay(clearNextIndex));
  $('clear-pick').addEventListener('click', () => openPicker('clear'));
  menuBtn.addEventListener('click', onPause);

  let clearNextIndex = 0;
  let hintTimer = 0;
  let levelShown = -1; // the maze on the HUD plate
  let clearArgs = null; // what the clear card was last asked to say
  let hintKey = null; // the hint line's words, while it is showing

  function paintLevel() {
    if (levelShown >= 0) levelName.textContent = t('level.plate', levelShown + 1, mazeName(levels[levelShown].name));
  }

  function paintClear() {
    if (!clearArgs) return;
    const [i, time, kind] = clearArgs;
    $('clear-time').textContent = t('clear.time', formatTime(time));
    const best = $('clear-best');
    best.hidden = kind === 'first';
    best.textContent = kind === 'best' ? t('clear.newBest') : t('clear.best', formatTime(bestTime(levels[i].name)));
    $('clear-next').textContent = t(i === levels.length - 1 ? 'fromStart' : 'next');
  }

  // The language rows, on the title card and in the pause card. setLang
  // repaints every [data-i18n] itself; the rest is repainted below.
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.addEventListener('click', () => setLang(b.dataset.lang));
  }
  document.addEventListener('arcade:lang', () => {
    paintLevel();
    paintClear();
    if (!cards.picker.hidden) {
      const focused = document.activeElement;
      const idx = focused && focused.parentElement === tiles ? [...tiles.children].indexOf(focused) : -1;
      fillPicker();
      if (idx >= 0) tiles.children[idx].focus({ preventScroll: true });
    }
    if (hintKey && hint.classList.contains('show')) hint.textContent = t(hintKey);
  });
  paintStatic();

  return {
    showStart: () => show('start'),
    hideCards: () => show(null),
    showPause(tiltLive) {
      $('pause-level').hidden = !tiltLive;
      show('pause');
    },
    paused: () => !cards.pause.hidden,
    anyCard: () => Object.values(cards).some((c) => !c.hidden),
    setLevel(i) {
      levelShown = i;
      paintLevel();
    },
    // kind: 'first' (never finished before), 'best' (beat the old time),
    // or 'slower' (finished, the old best stands and is shown).
    showClear(i, time, kind) {
      clearArgs = [i, time, kind];
      clearNextIndex = i === levels.length - 1 ? 0 : i + 1;
      paintClear();
      show('clear');
    },
    // key: 'hint.device' | 'hint.drag' | 'hint.keys', rendered here so a
    // language switch can repaint a hint that is still showing.
    hint(key) {
      hintKey = key;
      hint.textContent = t(key);
      hint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('show'), 3500);
    },
  };
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)} s`;
}
