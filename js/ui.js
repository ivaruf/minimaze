/*
 * ui.js — the cards, the maze picker, the HUD and the hint line.
 *
 * Every card is a wooden panel cut from the board's own plank: main.js
 * paints the wood once (render/board-mesh.js) and hands the canvases over
 * as data URLs, which style.css reads through --wood-light / --wood-dark.
 * This file only decides what is showing and what the words say.
 *
 *   start   the title, Play (the next unfinished maze), Pick a level, the
 *           language row, and the way back to the arcade
 *   picker  every maze as a numbered tile, ticked once finished; none are
 *           locked (DESIGN.md §5: no locked doors)
 *   pause   the one menu panel, behind the menu plate. In a maze it is
 *           the Pause face: resume, restart, pick a level, "reset the tilt"
 *           when device tilt is live. Anywhere else it is the Settings
 *           face: no Resume, and a Back to the card it was opened over.
 *           Both faces carry MUSIC and EFFECTS, the language row and the
 *           way back to the arcade, last. Solo game, so the menu pauses.
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
 * THE WAY BACK TO THE ARCADE ends the start card and the pause card, at the
 * top level of each and never a panel deeper (hub §2, "One button"). It is
 * wired here: wireExit() below, retried by main.js because exit.js is a
 * deferred classic script from another repo that may be late or missing.
 *
 * ESCAPE is decided by main.js in one place; this file only answers what is
 * showing (current()) and does the step back (pickerBackTo(), quit()).
 *
 * THE CORNER (hub §2) is three plates on every screen: menu (wired here,
 * decided by main.js), sound (a live mute, wired here: one tap, nothing
 * opened, nothing paused), fullscreen (js/screen.js, self-contained).
 * MiniMaze makes no sound yet, so mute and the two volume rows only
 * persist (js/store.js) and the panel says plainly that the game is silent.
 */

import { bestTime, volume, setVolume, muted, setMuted } from './store.js';
import { t, mazeName, setLang, paintStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function createUI({ levels, onPlay, onResume, onRestart, onCalibrate, onMenu }) {
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
  let face = 'pause'; // the menu panel's face: 'pause' (in a maze) | 'settings'
  let settingsFrom = 'start'; // which card the Settings face's Back returns to

  function show(name) {
    for (const [k, el] of Object.entries(cards)) el.hidden = k !== name;
    // The maze's nameplate belongs to a maze: over a run (rolling, paused,
    // or just cleared), not over the title, the picker or Settings.
    hud.hidden = !(name === null || name === 'clear' || (name === 'pause' && face === 'pause'));
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
  $('settings-back').addEventListener('click', () => show(settingsFrom));
  menuBtn.addEventListener('click', onMenu);

  // The menu panel's two faces: one card, so the volumes, the language and
  // the way out are the same controls in both.
  function setFace(next, tiltLive) {
    face = next;
    const inMaze = face === 'pause';
    const title = $('pause-title');
    title.dataset.i18n = inMaze ? 'paused' : 'settings';
    title.textContent = t(title.dataset.i18n);
    $('pause-tag').hidden = !inMaze;
    $('pause-resume').hidden = !inMaze;
    $('pause-restart').hidden = !inMaze;
    $('pause-pick').hidden = !inMaze;
    $('pause-level').hidden = !(inMaze && tiltLive);
    $('settings-back').hidden = inMaze;
    cards.pause.classList.toggle('settings', !inMaze);
  }

  /*
   * Sound: the corner's mute and the panel's two levels. aria-pressed on the
   * plate is the state and CSS draws waves or slash off it; the label names
   * what a press will do, written in the same breath. Moving a slider lifts
   * the mute — a volume you cannot hear is one you cannot set (hub §2).
   */
  const soundBtn = $('sound-btn');
  let isMuted = muted();
  function paintMute() {
    const label = t(isMuted ? 'unmute' : 'mute');
    soundBtn.setAttribute('aria-pressed', String(isMuted));
    soundBtn.setAttribute('aria-label', label);
    soundBtn.title = label;
  }
  soundBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    setMuted(isMuted);
    paintMute();
  });
  for (const bus of ['music', 'sfx']) {
    const input = $(`vol-${bus}`);
    const out = $(`vol-${bus}-out`);
    const v = Math.round(volume(bus) * 100);
    input.value = String(v);
    out.value = String(v);
    input.addEventListener('input', () => {
      out.value = input.value;
      setVolume(bus, Number(input.value) / 100);
      if (isMuted) {
        isMuted = false;
        setMuted(false);
        paintMute();
      }
    });
  }
  paintMute();

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
    paintMute();
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

  /*
   * The arcade door. Shown only when there is somewhere to go — a launcher
   * framing us, or an installed window that can close — asked through
   * framed()/standalone() rather than offers(), because the exit.js that
   * answers may be an older cached copy that predates offers(), and a guard
   * on the new name fails CLOSED inside the arcade, where the way out matters
   * most. The words come from verb(), handed both phrasings in the current
   * language, so the label never promises what quit() will not do; a
   * language switch asks again. Only the label span is repainted, so the
   * drawn arrow in front of it stays put.
   */
  const exitBtns = [$('start-exit'), $('pause-exit')];
  let exitApi = null;
  let exitRefused = false;

  function paintExit() {
    if (!exitApi) return;
    let label;
    try {
      label = exitRefused ? t('exit.refused') : exitApi.verb({ arcade: t('exit.arcade'), app: t('exit.close') });
    } catch {
      label = t('exit.arcade');
    }
    for (const b of exitBtns) b.querySelector('.exit-label').textContent = label;
  }
  document.addEventListener('arcade:lang', paintExit);

  function quit() {
    if (!exitApi || exitRefused) return;
    Promise.resolve(exitApi.quit())
      .then((how) => {
        // 'refused': the browser would not close a window it did not open.
        // The game is still running, so say so instead of a dead button.
        if (how !== 'refused') return;
        exitRefused = true;
        for (const b of exitBtns) b.disabled = true;
        paintExit();
      })
      .catch(() => {});
  }
  for (const b of exitBtns) b.addEventListener('click', quit);

  let exitWired = false;
  function wireExit() {
    if (exitWired) return true;
    const exit = window.ArcadeExit;
    if (!exit) return false;
    exitWired = true;
    let show = false;
    try {
      show = exit.framed() || exit.standalone();
    } catch {
      show = false;
    }
    if (!show) return true;
    exitApi = exit;
    for (const b of exitBtns) b.hidden = false;
    paintExit();
    return true;
  }

  function current() {
    for (const [k, el] of Object.entries(cards)) if (!el.hidden) return k;
    return null;
  }

  return {
    wireExit,
    current,
    // Escape on the start card is this button, and only while it is shown.
    exitShown: () => exitApi != null && !exitRefused,
    quit,
    // The picker's Back, for Escape: the same step its button takes.
    pickerBackTo: () => show(pickerBack),
    showStart: () => show('start'),
    hideCards: () => show(null),
    showPause(tiltLive) {
      setFace('pause', tiltLive);
      show('pause');
    },
    // The menu plate away from a maze: the same panel, Settings face, over
    // whichever card was showing.
    showSettings() {
      settingsFrom = current() || 'start';
      setFace('settings');
      show('pause');
    },
    inSettings: () => !cards.pause.hidden && face === 'settings',
    // The Settings face's Back, for Escape and the plate.
    settingsBack: () => show(settingsFrom),
    paused: () => !cards.pause.hidden && face === 'pause',
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
