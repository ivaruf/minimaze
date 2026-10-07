/*
 * pointer.js — drag, keyboard and gamepad, each turned into the same tilt
 * tilt.js produces: {x, y} in radians, SCREEN terms (x > 0 right side down,
 * y > 0 near edge down).
 *
 *   DRAG   press anywhere on the board and push: the offset from where the
 *          finger landed is the tilt, like leaning on the board's edge.
 *          Let go and it eases back to level. Pointer Events only, one path
 *          for mouse, pen and touch (hub §10).
 *   KEYS   arrows / WASD hold full tilt; the board's own easing turns a tap
 *          into a nudge, so no key needs a ramp of its own.
 *   PAD    left stick, past a deadzone. Polled: gamepads have no events
 *          worth listening to for an axis.
 *
 * Priority is decided in read(): a held drag wins, then keys or stick, and
 * only then does the caller fall back to device tilt.
 */

import { MAX_TILT, DRAG_FULL, PAD_DEADZONE } from '../config.js';

let dragId = null;
let ox = 0;
let oy = 0;
let dx = 0;
let dy = 0;
const keys = new Set();

const KEYMAP = {
  ArrowLeft: 'l', KeyA: 'l',
  ArrowRight: 'r', KeyD: 'r',
  ArrowUp: 'u', KeyW: 'u',
  ArrowDown: 'd', KeyS: 'd',
};

export function attach(surface) {
  surface.addEventListener('pointerdown', (e) => {
    if (dragId !== null) return;
    dragId = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    dx = dy = 0;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the drag still works without it */
    }
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    dx = e.clientX - ox;
    dy = e.clientY - oy;
  });
  const end = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    dx = dy = 0;
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    keys.add(k);
    e.preventDefault(); // arrows would scroll a page that should not move
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });
  // A key held while focus leaves would stay "down" forever.
  window.addEventListener('blur', () => keys.clear());
}

export function dragging() {
  return dragId !== null;
}

/* Fill `out` and return true if any of these sources is asking for tilt. */
export function read(out) {
  if (dragId !== null) {
    const full = Math.min(innerWidth, innerHeight) * DRAG_FULL;
    out.x = clamp(dx / full) * MAX_TILT;
    out.y = clamp(dy / full) * MAX_TILT;
    return true;
  }
  let x = 0;
  let y = 0;
  if (keys.has('l')) x -= 1;
  if (keys.has('r')) x += 1;
  if (keys.has('u')) y -= 1;
  if (keys.has('d')) y += 1;
  const pad = stick();
  if (pad) {
    x += pad[0];
    y += pad[1];
  }
  if (x === 0 && y === 0) return false;
  out.x = clamp(x) * MAX_TILT;
  out.y = clamp(y) * MAX_TILT;
  return true;
}

// Reused so polling allocates nothing per frame.
const axes = [0, 0];
function stick() {
  if (!navigator.getGamepads) return null;
  let pads;
  try {
    pads = navigator.getGamepads();
  } catch {
    return null; // a permissions policy can refuse gamepads in a frame
  }
  for (const p of pads) {
    if (!p || p.axes.length < 2) continue;
    const ax = p.axes[0];
    const ay = p.axes[1];
    if (Math.hypot(ax, ay) < PAD_DEADZONE) continue;
    axes[0] = ax;
    axes[1] = ay;
    return axes;
  }
  return null;
}

const clamp = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);
