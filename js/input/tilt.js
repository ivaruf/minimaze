/*
 * tilt.js — the phone or tablet in your hands, as a tilt.
 *
 * Output is in SCREEN terms: `x` > 0 means the right side of the screen is
 * down, `y` > 0 means the near (bottom) edge is down. Both in radians.
 * main.js turns screen terms into board terms, because the board may be
 * turned on screen.
 *
 * Three things make this harder than reading beta and gamma:
 *
 *   EULER ANGLES WRAP. Hold a phone sideways at 40° and gamma is the tilt
 *   that matters, and it jumps at ±90. So the reading is turned into a
 *   gravity vector in the device's own frame first, which never jumps.
 *
 *   NOBODY HOLDS IT FLAT. "Level" is whatever the device was doing when the
 *   level started (calibrate()). The tilt is measured from there, in a frame
 *   built around that gravity, so holding a tablet at 40° on your knees and
 *   tilting it left reads the same as tilting a flat one.
 *
 *   THE SCREEN TURNS. screen.orientation.angle rotates device axes into
 *   screen axes, so "right" is the screen's right in landscape too.
 *
 * iOS hides the sensor behind DeviceOrientationEvent.requestPermission(),
 * which only works from inside a tap; enable() is called from the start
 * button for that reason. Refusal, or no sensor, is a normal outcome: the
 * game falls back to drag (input/pointer.js) and says which control is live.
 */

// Gravity in device coordinates from the latest event, and the calibrated
// frame: e1 is "device right" and e2 "device top", both laid in the plane
// level to the calibrated gravity.
const g = [0, 0, -1];
const e1 = [1, 0, 0];
const e2 = [0, 1, 0];
let seen = false; // a real reading has arrived
let calibrated = false;
let listening = false;

export const state = { active: false };

export async function enable() {
  if (listening) return state.active;
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  const ask = DeviceOrientationEvent.requestPermission;
  if (typeof ask === 'function') {
    try {
      if ((await ask.call(DeviceOrientationEvent)) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  window.addEventListener('deviceorientation', onOrientation);
  listening = true;
  // Desktop browsers fire one event with null angles, or nothing at all, so
  // "active" waits for a real reading rather than trusting the listener.
  return true;
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  const b = (e.beta * Math.PI) / 180;
  const gm = (e.gamma * Math.PI) / 180;
  // Gravity in the device frame for the W3C Z-X'-Y'' rotation; alpha (the
  // compass heading) drops out because gravity points straight down.
  g[0] = Math.cos(b) * Math.sin(gm);
  g[1] = -Math.sin(b);
  g[2] = -Math.cos(b) * Math.cos(gm);
  if (!seen) {
    seen = true;
    state.active = true;
  }
  if (!calibrated) calibrate();
}

/* Make the current hold "level". */
export function calibrate() {
  if (!seen) return;
  calibrated = true;
  // e1: device right with the gravity component removed.
  const d = g[0];
  e1[0] = 1 - d * g[0];
  e1[1] = -d * g[1];
  e1[2] = -d * g[2];
  const n = Math.hypot(e1[0], e1[1], e1[2]) || 1;
  e1[0] /= n;
  e1[1] /= n;
  e1[2] /= n;
  // e2 = up × e1, with up = -g: points toward the device's top edge.
  e2[0] = -(g[1] * e1[2] - g[2] * e1[1]);
  e2[1] = -(g[2] * e1[0] - g[0] * e1[2]);
  e2[2] = -(g[0] * e1[1] - g[1] * e1[0]);
}

/*
 * Read the tilt into `out` ({x, y}, radians, screen terms). The components
 * of gravity along the calibrated plane are sines of the tilt about each
 * axis, which is exactly what the physics wants; asin gives it back as an
 * angle so every input source speaks the same unit.
 */
export function read(out, gain) {
  if (!state.active) return false;
  const dx = g[0] * e1[0] + g[1] * e1[1] + g[2] * e1[2]; // > 0: right is down
  const dy = g[0] * e2[0] + g[1] * e2[1] + g[2] * e2[2]; // > 0: top is down
  const a = screenAngle();
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Screen right and screen up, expressed in device axes, for a screen
  // turned `a` counter-clockwise from the device's natural orientation.
  const sx = dx * c - dy * s;
  const su = dx * s + dy * c;
  out.x = Math.asin(clamp(sx * gain));
  out.y = -Math.asin(clamp(su * gain)); // top down = near edge up
  return true;
}

function screenAngle() {
  let deg = 0;
  try {
    if (screen.orientation && typeof screen.orientation.angle === 'number') deg = screen.orientation.angle;
    else if (typeof window.orientation === 'number') deg = window.orientation;
  } catch {
    /* an old engine; assume natural orientation */
  }
  return (deg * Math.PI) / 180;
}

const clamp = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);
