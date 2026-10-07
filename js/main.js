/*
 * main.js — boot, the fixed-step loop, and the wiring between the parts.
 *
 * M1 (DESIGN.md §8): three mazes, the full physics, tilt + drag + keys +
 * stick, the scene. Menus are a start card and a clear card and no more;
 * the hub's menu floor arrives in M2. The question this build answers is
 * whether the marble feels like a marble.
 *
 * Each frame:
 *   1. read the target tilt from the strongest live source, in SCREEN terms
 *   2. turn it into BOARD terms (the board may be turned 90° on screen)
 *   3. fixed steps at 120 Hz: ease the board toward the target, step the sim
 *   4. route the sim's events (wall knocks to the camera, goal to the card)
 *   5. draw the board at its eased tilt and the marble at its state
 *
 * The physics reads the eased tilt, not the target, so what you see the
 * board doing is what is rolling the ball.
 */

import * as C from './config.js';
import { LEVELS } from './levels.js';
import { parseBoard } from './sim/board.js';
import { createMarble, step } from './sim/marble.js';
import * as tilt from './input/tilt.js';
import * as pointer from './input/pointer.js';
import { createScene } from './render/scene.js';
import { buildBoard } from './render/board-mesh.js';
import { createMarbleMesh } from './render/marble-mesh.js';

const canvas = document.getElementById('view');
const startCard = document.getElementById('start');
const startBtn = document.getElementById('start-go');
const clearCard = document.getElementById('clear');
const clearTime = document.getElementById('clear-time');
const clearNext = document.getElementById('clear-next');
const levelName = document.getElementById('level-name');
const hint = document.getElementById('hint');

let view;
try {
  view = createScene(canvas);
} catch (err) {
  // No WebGL: say so in words rather than leaving a blank brown page.
  document.getElementById('no-gl').hidden = false;
  startCard.hidden = true;
  throw err;
}

const marbleMesh = createMarbleMesh();
pointer.attach(canvas);

let levelIndex = 0;
let board = null;
let boardMesh = null;
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

function loadLevel(i) {
  levelIndex = i;
  board = parseBoard(LEVELS[i]);
  if (boardMesh) {
    view.tilt.remove(boardMesh.group);
    boardMesh.dispose();
  }
  boardMesh = buildBoard(board, view.renderer);
  view.tilt.add(boardMesh.group);
  if (!marble) view.tilt.add(marbleMesh.mesh);
  marble = createMarble(board);
  marbleMesh.snap(marble);
  eased.x = eased.z = 0;
  elapsed = 0;
  levelName.textContent = `${i + 1}. ${board.name}`;
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
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') tilt.calibrate();
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
// one is used, then fading. Not a tutorial: a confirmation.
const told = new Set();
let hintTimer = 0;
function showHint(src) {
  if (told.has(src)) return;
  told.add(src);
  hint.textContent =
    src === 'device'
      ? 'Tilt to roll. Hold it however you like: that is level.'
      : src === 'drag'
        ? 'Drag to tilt the board.'
        : 'Arrows tilt the board.';
  hint.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.remove('show'), 3500);
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
    // Behind a card the board breathes a little so the scene is alive.
    const t = now / 1000;
    eased.x = Math.sin(t * 0.7) * 0.04;
    eased.z = Math.sin(t * 0.53) * 0.04;
  }

  // The board's drawn tilt: full for drag and keys, damped for device tilt.
  const want = source === 'device' && playing ? C.VISUAL_TILT_DEVICE : 1;
  visual += (want - visual) * Math.min(1, dt * 4);
  view.tilt.rotation.set(eased.z * visual, 0, -eased.x * visual);

  marbleMesh.place(marble, boardMesh.cupY);
  view.render(dt);
}

function handleEvents() {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'wall') view.nudge(Math.min(0.04, e.speed * 0.004));
    else if (e.type === 'respawn') marbleMesh.snap(marble);
  }
  events.length = 0;
  // The card waits for the marble to finish sinking into the cup.
  if (playing && marble.mode === 'goal' && marble.t >= C.GOAL_TIME) showClear();
}

function showClear() {
  playing = false;
  clearTime.textContent = formatTime(elapsed);
  const lastLevel = levelIndex === LEVELS.length - 1;
  clearNext.textContent = lastLevel ? 'From the start' : 'Next maze';
  clearCard.hidden = false;
  clearNext.focus();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)} s`;
}

clearNext.addEventListener('click', () => {
  clearCard.hidden = true;
  loadLevel((levelIndex + 1) % LEVELS.length);
  playing = true;
});

startBtn.addEventListener('click', async () => {
  // The permission prompt must be asked from inside this tap (iOS), so
  // enable() calls it before its first await.
  const ok = await tilt.enable();
  startCard.hidden = true;
  tilt.calibrate();
  playing = true;
  if (!ok) showHint(matchMedia('(pointer: coarse)').matches ? 'drag' : 'keys');
});

loadLevel(0);
// On the start card the marble already sits at home rather than waiting to
// swell into being: the first thing a player sees is the toy, ready.
marble.mode = 'roll';
startBtn.focus();
requestAnimationFrame(frame);
