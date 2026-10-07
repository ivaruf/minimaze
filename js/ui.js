/*
 * ui.js — the cards, the maze picker, the HUD and the hint line.
 *
 * Every card is a wooden panel cut from the board's own plank: main.js
 * paints the wood once (render/board-mesh.js) and hands the canvases over
 * as data URLs, which style.css reads through --wood-light / --wood-dark.
 * This file only decides what is showing and what the words say.
 *
 *   start   the title, "Roll!" (the next unfinished maze) and "Pick a maze"
 *   picker  every maze as a numbered tile, ticked once finished; none are
 *           locked (DESIGN.md §5: no locked doors)
 *   pause   behind the menu plate: keep rolling, start over, pick a maze,
 *           and "level the board" when device tilt is live. Solo game, so
 *           the menu pauses (hub §2).
 *   clear   "Home!", the time, a new-best line, next maze / pick a maze
 *
 * The hub's corner (sound and fullscreen beside the menu plate), the volume
 * panel and the way back to the arcade arrive with the M2 menu floor.
 */

import { bestTime } from './store.js';

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
      const t = bestTime(l.name);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile' + (t != null ? ' done' : '');
      b.innerHTML = `<span class="n">${i + 1}</span>`;
      b.title = l.name;
      b.setAttribute(
        'aria-label',
        `Maze ${i + 1}, ${l.name}` + (t != null ? `, done in ${formatTime(t)}` : ''),
      );
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
      levelName.textContent = `${i + 1}. ${levels[i].name}`;
    },
    // kind: 'first' (never finished before), 'best' (beat the old time),
    // or 'slower' (finished, the old best stands and is shown).
    showClear(i, time, kind) {
      $('clear-time').textContent = formatTime(time);
      const best = $('clear-best');
      best.hidden = kind === 'first';
      best.textContent = kind === 'best' ? 'A new best!' : `Best so far ${formatTime(bestTime(levels[i].name))}`;
      const lastOne = i === levels.length - 1;
      clearNextIndex = lastOne ? 0 : i + 1;
      $('clear-next').textContent = lastOne ? 'From the start' : 'Next maze';
      show('clear');
    },
    hint(text) {
      hint.textContent = text;
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
