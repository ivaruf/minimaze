/*
 * marble.js — one steel ball on one tilted plank, in board space.
 *
 * The whole physics of the game, and deliberately small (DESIGN.md §4): a
 * ball on a plane is 2D once you look at it from the plank's point of view.
 * Tilt becomes acceleration along the slope; walls are the grid's own cells,
 * collided as boxes; holes and the goal are circles the ball's centre falls
 * into. No three.js, no DOM: step() takes a state and a tilt and reports what
 * happened as events, and everything else is a view of that.
 *
 * The board's gadgets (kickers, gears, switches, gates) live in gadgets.js;
 * this file calls into them at fixed points in the step.
 *
 * Modes:
 *   spawn  popping out at the start; frozen, the renderer grows it
 *   roll   free
 *   fall   dropping through a hole; frozen, then respawns
 *   goal   sinking into the goal cup; frozen, the level is won
 */

import * as C from '../config.js';
import { resetGadgets, turnGears, gearGrip, triggers } from './gadgets.js';

export function createMarble(board) {
  resetGadgets(board);
  return {
    x: board.start.x,
    z: board.start.z,
    vx: 0,
    vz: 0,
    mode: 'spawn',
    t: 0,
    air: 0, // seconds of flight left after a kicker; 0 on the ground
    // The hole or cup being fallen into, for the renderer's drop animation.
    into: null,
  };
}

export function respawn(m, board) {
  m.x = board.start.x;
  m.z = board.start.z;
  m.vx = m.vz = 0;
  m.air = 0;
  m.mode = 'spawn';
  m.t = 0;
  m.into = null;
  // A fall puts the whole board back as the level began: gates, pads, all.
  resetGadgets(board);
}

/*
 * Advance one fixed step. `tilt` is the board's actual (eased) tilt: tx > 0
 * lowers the right edge, tz > 0 lowers the near edge. Events are pushed onto
 * `events` as plain objects so the caller can route them to sound and camera.
 */
export function step(m, board, tilt, dt, events) {
  turnGears(board, dt);
  if (m.mode !== 'roll') {
    m.t += dt;
    if (m.mode === 'spawn' && m.t >= C.SPAWN_TIME) {
      m.mode = 'roll';
      m.t = 0;
    } else if (m.mode === 'fall' && m.t >= C.FALL_TIME) {
      respawn(m, board);
      events.push({ type: 'respawn' });
    }
    return;
  }

  // In flight: straight line, no tilt, no friction, no gear, and nothing
  // on the floor can catch it. Walls are tall enough to stop it anyway.
  if (m.air > 0) {
    m.air -= dt;
    m.x += m.vx * dt;
    m.z += m.vz * dt;
    collideWalls(m, board, events);
    if (m.air <= 0) {
      m.air = 0;
      m.vx *= C.LAND_KEEP;
      m.vz *= C.LAND_KEEP;
      events.push({ type: 'land' });
    }
    return; // holes and pads are checked from the next step, on the ground
  }

  const g = C.GRAVITY * C.ROLL_FACTOR;
  let ax = g * Math.sin(tilt.x);
  let az = g * Math.sin(tilt.z);

  // The lip of every hole pulls inward, strongest at the edge. The goal is a
  // hole too, so a ball rolling past the cup is helped in, which is kind.
  for (let i = 0; i < board.holes.length; i++) {
    ax += rim(m, board.holes[i], C.HOLE_R);
    az += rimZ;
  }
  ax += rim(m, board.goal, C.GOAL_R);
  az += rimZ;

  m.vx += ax * dt;
  m.vz += az * dt;
  gearGrip(m, board, dt);

  // Rolling friction is a constant deceleration opposing motion (it cannot
  // reverse it), plus a little proportional drag so the top speed settles.
  let sp = Math.hypot(m.vx, m.vz);
  if (sp > 0) {
    const drop = (C.ROLL_FRICTION + C.DAMPING * sp) * dt;
    const k = sp > drop ? (sp - drop) / sp : 0;
    m.vx *= k;
    m.vz *= k;
    sp *= k;
  }
  if (sp > C.MAX_SPEED) {
    const k = C.MAX_SPEED / sp;
    m.vx *= k;
    m.vz *= k;
  }

  m.x += m.vx * dt;
  m.z += m.vz * dt;

  collideWalls(m, board, events);
  triggers(m, board, events);

  if (inside(m, board.goal, C.GOAL_R)) {
    m.mode = 'goal';
    m.t = 0;
    m.into = board.goal;
    events.push({ type: 'goal' });
    return;
  }
  for (let i = 0; i < board.holes.length; i++) {
    const h = board.holes[i];
    if (inside(m, h, C.HOLE_R)) {
      m.mode = 'fall';
      m.t = 0;
      m.into = h;
      events.push({ type: 'fall', speed: Math.hypot(m.vx, m.vz) });
      return;
    }
  }
}

// The ball drops once its centre is over the opening; until then its
// underside is still on wood.
function inside(m, h, r) {
  const dx = m.x - h.x;
  const dz = m.z - h.z;
  return dx * dx + dz * dz < r * r;
}

// rim() returns the x pull and leaves the z pull in rimZ: two numbers out of
// one call with no object allocated per hole per step (hub §10).
let rimZ = 0;
function rim(m, h, r) {
  rimZ = 0;
  const dx = h.x - m.x;
  const dz = h.z - m.z;
  const d = Math.hypot(dx, dz);
  const outer = r + C.RIM_EXTRA;
  if (d >= outer || d < 1e-6) return 0;
  const strength = C.RIM_PULL * Math.min(1, 1 - (d - r) / C.RIM_EXTRA);
  rimZ = (dz / d) * strength;
  return (dx / d) * strength;
}

/*
 * Circle against the wall cells around it. Each wall cell is a unit box; the
 * closest point on the box to the ball's centre gives the contact normal.
 *
 * The seam trick: a straight wall is several boxes side by side, and a ball
 * sliding along it can catch the *corner* of the next box and get a diagonal
 * shove, which feels like a snag on a perfectly flat wall. A box corner is
 * only a real corner if neither of the box's neighbours on the ball's side
 * is wall; otherwise that neighbour's face covers it, and the box is skipped.
 * The contact then comes out as a face, as it should.
 */
function collideWalls(m, board, events) {
  const R = C.BALL_R;
  const [c0, r0] = board.cellOf(m.x, m.z);
  let hardest = 0;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (!board.isWall(c, r)) continue;
      const bx0 = board.x0(c);
      const bz0 = board.z0(r);
      const bx1 = bx0 + 1;
      const bz1 = bz0 + 1;

      // Which side of the box the ball is on, per axis: -1, 0 (within), +1.
      const sx = m.x < bx0 ? -1 : m.x > bx1 ? 1 : 0;
      const sz = m.z < bz0 ? -1 : m.z > bz1 ? 1 : 0;
      if (sx && sz && (board.isWall(c + sx, r) || board.isWall(c, r + sz))) continue;
      const px = sx < 0 ? bx0 : sx > 0 ? bx1 : m.x;
      const pz = sz < 0 ? bz0 : sz > 0 ? bz1 : m.z;

      let nx = m.x - px;
      let nz = m.z - pz;
      let d = Math.hypot(nx, nz);
      if (d >= R) continue;
      if (d < 1e-6) {
        // Centre inside the box: should not happen at these speeds, but if it
        // does, leave by the nearest face rather than freezing.
        const ex = Math.min(m.x - bx0, bx1 - m.x);
        const ez = Math.min(m.z - bz0, bz1 - m.z);
        if (ex < ez) { nx = m.x - bx0 < bx1 - m.x ? -1 : 1; nz = 0; d = 0; }
        else { nz = m.z - bz0 < bz1 - m.z ? -1 : 1; nx = 0; d = 0; }
      } else {
        nx /= d;
        nz /= d;
      }

      const push = R - d;
      m.x += nx * push;
      m.z += nz * push;
      const vn = m.vx * nx + m.vz * nz;
      if (vn < 0) {
        m.vx -= (1 + C.RESTITUTION) * vn * nx;
        m.vz -= (1 + C.RESTITUTION) * vn * nz;
        if (-vn > hardest) hardest = -vn;
      }
    }
  }
  if (hardest >= C.WALL_EVENT_MIN) events.push({ type: 'wall', speed: hardest });
}
