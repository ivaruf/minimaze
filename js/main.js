/*
 * main.js — boot, the fixed-step loop, and the wiring between the parts.
 *
 * Each frame:
 *   1. read the target tilt from the strongest live source, in SCREEN terms
 *   2. turn it into BOARD terms (the board may be turned 90° on screen)
 *   3. fixed steps at 120 Hz: ease the board toward the target, step the sim
 *   4. route the sim's events (knocks to the camera, kicks to the gadgets,
 *      the goal to the clear card)
 *   5. draw the board at its eased tilt, the gadgets and the marble
 *
 * The physics reads the eased tilt, not the target, so what you see the
 * board doing is what is rolling the ball.
 *
 * Still to come in M2 (DESIGN.md §7–8): the hub's corner (sound,
 * fullscreen) and sound itself. The way back to the arcade is drawn by
 * ui.js and looked for from the bottom of this file. The service worker
 * is not wired from here at all: js/update.js owns it, in a module graph of
 * its own.
 */

import * as C from './config.js';
import { LEVELS } from './levels.js';
import { parseBoard } from './sim/board.js';
import { createMarble, step } from './sim/marble.js';
import * as tilt from './input/tilt.js';
import * as pointer from './input/pointer.js';
import { createScene } from './render/scene.js';
import { buildBoard, woods } from './render/board-mesh.js';
import { createGadgets } from './render/gadgets-mesh.js';
import { createMarbleMesh } from './render/marble-mesh.js';
import { createUI } from './ui.js';
import * as store from './store.js';
import { paintStatic } from './i18n.js';

const canvas = document.getElementById('view');

// The words first: if WebGL fails below, the card that says so must already
// speak the player's language (ui.js repaints again once it exists).
paintStatic();

let view;
try {
  view = createScene(canvas);
} catch (err) {
  // No WebGL: say so in words rather than leaving a blank brown page.
  document.getElementById('no-gl').hidden = false;
  document.getElementById('start').hidden = true;
  throw err;
}

// The menus are cut from the board's own wood (ui.js, style.css).
{
  const w = woods(view.renderer);
  const root = document.documentElement.style;
  root.setProperty('--wood-light', `url(${w.light.image.toDataURL('image/jpeg', 0.85)})`);
  root.setProperty('--wood-dark', `url(${w.dark.image.toDataURL('image/jpeg', 0.85)})`);
}

const marbleMesh = createMarbleMesh();
pointer.attach(canvas);

let levelIndex = 0;
let board = null;
let boardMesh = null;
let gadgets = null;
let marble = null;
let playing = false;
let elapsed = 0; // stopwatch: rolling time only, shown on the clear card
let yaw = 0;

// Tilts, in radians. `target` and `eased` are BOARD terms; `screenT` is the
// raw reading. All reused: nothing in the loop allocates (hub §10).
const screenT = { x: 0, y: 0 };
const target = { x: 0, z: 0 };
const eased = { x: 0, z: 0 };
let visual = 1; // how much of the tilt the drawing shows; see config
let source = 'none';
const events = [];

const ui = createUI({
  levels: LEVELS,
  onPlay: async (i) => {
    // Any way into a maze is a tap, and iOS only shares the tilt sensor if
    // asked from inside one; enable() asks before its first await.
    const ok = await tilt.enable();
    loadLevel(i);
    ui.hideCards();
    playing = true;
    if (!ok && !told.size) showHint(matchMedia('(pointer: coarse)').matches ? 'drag' : 'keys');
  },
  onResume: () => resume(),
  onRestart: () => {
    loadLevel(levelIndex);
    ui.hideCards();
    playing = true;
  },
  onCalibrate: () => tilt.calibrate(),
  onPause: pause,
});

function pause() {
  if (!playing) return;
  playing = false;
  ui.showPause(tilt.state.active);
}

function loadLevel(i) {
  levelIndex = i;
  board = parseBoard(LEVELS[i]);
  if (boardMesh) {
    view.tilt.remove(boardMesh.group, gadgets.group);
    boardMesh.dispose();
    gadgets.dispose();
  }
  marble = createMarble(board); // also resets the gadgets, which build reads
  boardMesh = buildBoard(board, view.renderer);
  gadgets = createGadgets(board, view.renderer);
  view.tilt.add(boardMesh.group, gadgets.group);
  if (!marbleMesh.mesh.parent) view.tilt.add(marbleMesh.mesh);
  marbleMesh.snap(marble);
  eased.x = eased.z = 0;
  elapsed = 0;
  ui.setLevel(i);
  resize();
  tilt.calibrate(); // "level" is however you are holding it right now
}

/*
 * A maze wider than tall on a tall screen (or the reverse) is turned 90° so
 * it fills the screen rather than shrinking into a strip. Square-ish mazes
 * are never turned: a turn is disorienting and only worth it when it buys a
 * lot of size.
 */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const boardWide = board.cols / board.rows;
  const screenWide = w / h;
  const mismatch = (boardWide > 1.15 && screenWide < 0.87) || (boardWide < 0.87 && screenWide > 1.15);
  yaw = mismatch ? Math.PI / 2 : 0;
  view.fit(w, h, board, yaw);
}
window.addEventListener('resize', () => board && resize());

// Turning the device changes what "level" means; re-zero once it settles.
const recal = () => setTimeout(() => tilt.calibrate(), 350);
try {
  screen.orientation.addEventListener('change', recal);
} catch {
  window.addEventListener('orientationchange', recal);
}
/*
 * ESCAPE GOES ONE STEP BACK (hub §2), decided here and nowhere else:
 *
 *   picker open        -> the picker's own Back (to whichever card opened it)
 *   rolling            -> open the pause card; the marble stops
 *   pause card open    -> close it; the marble rolls on from where it was
 *   clear card         -> the start card, the nearest screen with the way
 *                         out on it (the clear card has none of its own)
 *   start card         -> exactly the Back to arcade button: the same quit(),
 *                         and only when that button is showing
 *
 * So no single press ever throws a maze away, and Escape, Escape from
 * anywhere lands on a card with the way out on it. The listener is on the
 * capture phase and stops the event there, so it runs before pointer.js's
 * steering listener (also on window, registered earlier) and nothing else
 * ever sees an Escape; preventDefault for the browser's own. A held key
 * auto-repeats, which would flicker pause on and off, so repeats are eaten
 * too. P keeps its old job as a pause toggle; C still re-levels the tilt.
 */
function escape() {
  const card = ui.current();
  if (card === 'picker') ui.pickerBackTo();
  else if (playing) pause();
  else if (card === 'pause') resume();
  else if (card === 'clear') ui.showStart();
  else if (card === 'start' && ui.exitShown()) ui.quit();
}
function resume() {
  ui.hideCards();
  playing = true;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) escape();
    return;
  }
  if (e.code === 'KeyC') tilt.calibrate();
  if (e.code === 'KeyP') {
    if (playing) pause();
    else if (ui.paused()) resume();
  }
}, true);
// A tab put away mid-maze comes back paused, not rolling.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

function readInput() {
  let src = 'none';
  screenT.x = screenT.y = 0;
  if (pointer.read(screenT)) src = pointer.dragging() ? 'drag' : 'keys';
  else if (tilt.read(screenT, C.DEVICE_GAIN)) src = 'device';
  // Pointer sources stay inside ±MAX_TILT already; the device can exceed it.
  const lim = C.MAX_TILT;
  screenT.x = Math.max(-lim, Math.min(lim, screenT.x));
  screenT.y = Math.max(-lim, Math.min(lim, screenT.y));

  // Screen terms -> board terms through the board's turn on screen. With the
  // board turned by `yaw` about Y, its x axis lies along world
  // (cos yaw, -sin yaw) and its z axis along (sin yaw, cos yaw).
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  target.x = screenT.x * c - screenT.y * s;
  target.z = screenT.x * s + screenT.y * c;

  if (src !== 'none' && src !== source) showHint(src);
  if (src !== 'none') source = src;
}

// One line at the bottom saying which control is live, the first time each
// one is used. Not a tutorial: a confirmation.
const told = new Set();
function showHint(src) {
  if (told.has(src)) return;
  told.add(src);
  ui.hint(src === 'device' ? 'hint.device' : src === 'drag' ? 'hint.drag' : 'hint.keys');
}

// ---- the loop ----

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  // Clamp: a backgrounded tab returns with seconds of dt, which would be
  // either a spiral of steps or a marble through a wall.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (playing) {
    readInput();
    acc += dt;
    let n = 0;
    while (acc >= C.STEP && n < C.MAX_STEPS) {
      const k = 1 - Math.exp(-C.TILT_EASE * C.STEP);
      eased.x += (target.x - eased.x) * k;
      eased.z += (target.z - eased.z) * k;
      step(marble, board, eased, C.STEP, events);
      if (marble.mode === 'roll') elapsed += C.STEP;
      acc -= C.STEP;
      n++;
    }
    if (n === C.MAX_STEPS) acc = 0;
    handleEvents();
  } else {
    acc = 0;
    // Behind a card the board breathes a little so the scene is alive.
    const t = now / 1000;
    eased.x = Math.sin(t * 0.7) * 0.04;
    eased.z = Math.sin(t * 0.53) * 0.04;
  }

  // The board's drawn tilt: full for drag and keys, damped for device tilt.
  const want = source === 'device' && playing ? C.VISUAL_TILT_DEVICE : 1;
  visual += (want - visual) * Math.min(1, dt * 4);
  view.tilt.rotation.set(eased.z * visual, 0, -eased.x * visual);

  gadgets.update(marble, dt);
  marbleMesh.place(marble, boardMesh.cupY);
  view.render(dt);
}

function handleEvents() {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'wall') view.nudge(Math.min(0.04, e.speed * 0.004));
    else if (e.type === 'respawn') marbleMesh.snap(marble);
    else if (e.type === 'kick') {
      gadgets.onEvent(e);
      view.nudge(0.015);
    } else if (e.type === 'land') view.nudge(0.03);
  }
  events.length = 0;
  // The card waits for the marble to finish sinking into the cup.
  if (playing && marble.mode === 'goal' && marble.t >= C.GOAL_TIME) finishLevel();
}

function finishLevel() {
  playing = false;
  const name = LEVELS[levelIndex].name;
  const before = store.bestTime(name);
  const better = store.finish(name, elapsed);
  ui.showClear(levelIndex, elapsed, before == null ? 'first' : better ? 'best' : 'slower');
}

// Boot onto the title over the first maze, the marble already at home: the
// first thing a player sees is the toy, ready.
loadLevel(0);
marble.mode = 'roll';
ui.showStart();
requestAnimationFrame(frame);

// The way back to the arcade. exit.js is a deferred classic script from
// another repo and may be absent (served alone) or late (slow network), so
// look for it now, on load, and once more shortly after (lobbots); every
// outcome is normal.
if (!ui.wireExit()) {
  window.addEventListener('load', () => {
    if (!ui.wireExit()) setTimeout(() => ui.wireExit(), 1500);
  });
}
