/*
 * gadgets.js — the moving parts of a board: kickers, gears, switches, gates.
 *
 *   KICKER  > < ^ v   a spring pad. Roll onto its middle and it fires you
 *                     its way at LAUNCH_SPEED, whatever you were doing. In a
 *                     one-wide corridor that makes it a one-way valve, which
 *                     is a puzzle piece and also a way to trap a player, so
 *                     tools/check-levels.mjs refuses any level where a
 *                     reachable spot cannot still reach the goal.
 *   GEAR    @ &       a brass turntable set flush in the floor, clockwise
 *                     (@) or not (&), seen from above. The floor under the
 *                     marble moves, and grip drags the marble's velocity
 *                     toward it: ride it round, and leave at a tangent.
 *   SWITCH  *         a brass button. Rolling over it flips every gate on
 *                     the board. It re-arms once the marble has rolled off,
 *                     so sitting on it does not flicker the gates.
 *   GATE    = _       a block that rises out of the floor (= starts shut,
 *                     _ starts open). A gate never shuts on the marble: if
 *                     the marble is in the way it waits, then shuts the
 *                     moment the marble is clear.
 *
 * All of it is plain data on board.live. Arming uses two radii (trigger,
 * then re-arm further out) so a marble resting on the edge of a pad cannot
 * fire it every step.
 */

import * as C from '../config.js';

export function resetGadgets(board) {
  const n = board.gates.length;
  const live = board.live || { turn: 0 };
  live.shut = new Uint8Array(n);
  live.want = new Uint8Array(n);
  for (let i = 0; i < n; i++) live.shut[i] = live.want[i] = board.gates[i].shut ? 1 : 0;
  live.kickArmed = new Uint8Array(board.kickers.length).fill(1);
  live.switchArmed = new Uint8Array(board.switches.length).fill(1);
  live.flipped = false; // the gates are the other way round from the start
  board.live = live;
}

/* Gears keep turning whatever the marble is doing; the renderer reads it. */
export function turnGears(board, dt) {
  board.live.turn += dt * C.GEAR_SPIN;
}

/*
 * Drag the marble's velocity toward the moving floor of any gear it is on.
 * Floor velocity at offset (dx, dz) from the hub, turning clockwise as seen
 * from above (x right, z down the screen): spin · ω · (-dz, dx).
 */
export function gearGrip(m, board, dt) {
  for (let i = 0; i < board.gears.length; i++) {
    const g = board.gears[i];
    const dx = m.x - g.x;
    const dz = m.z - g.z;
    if (dx * dx + dz * dz > C.GEAR_R * C.GEAR_R) continue;
    const w = g.spin * C.GEAR_SPIN;
    const k = 1 - Math.exp(-C.GEAR_GRIP * dt);
    m.vx += (-dz * w - m.vx) * k;
    m.vz += (dx * w - m.vz) * k;
  }
}

/* Kickers, switches, and gates waiting to shut. Called after the move. */
export function triggers(m, board, events) {
  const live = board.live;

  for (let i = 0; i < board.kickers.length; i++) {
    const p = board.kickers[i];
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (live.kickArmed[i]) {
      if (d < C.PAD_TRIGGER) {
        live.kickArmed[i] = 0;
        // Fire along the pad, keep a little of the sideways motion, and
        // square up onto the pad's centre line so the shot runs true down
        // a corridor instead of rattling along one wall.
        const side = p.dx !== 0 ? m.vz : m.vx;
        if (p.dx !== 0) {
          m.vx = p.dx * C.LAUNCH_SPEED;
          m.vz = side * 0.2;
          m.z = p.z;
        } else {
          m.vz = p.dz * C.LAUNCH_SPEED;
          m.vx = side * 0.2;
          m.x = p.x;
        }
        events.push({ type: 'kick', i });
      }
    } else if (d > C.PAD_REARM) live.kickArmed[i] = 1;
  }

  for (let i = 0; i < board.switches.length; i++) {
    const s = board.switches[i];
    const d = Math.hypot(m.x - s.x, m.z - s.z);
    if (live.switchArmed[i]) {
      if (d < C.PAD_TRIGGER) {
        live.switchArmed[i] = 0;
        live.flipped = !live.flipped;
        for (let g = 0; g < live.want.length; g++) live.want[g] ^= 1;
        events.push({ type: 'switch', i, flipped: live.flipped });
      }
    } else if (d > C.PAD_REARM) live.switchArmed[i] = 1;
  }

  // Opening is immediate; shutting waits until the marble is clear of the
  // cell, so a gate can never close on top of it.
  for (let g = 0; g < board.gates.length; g++) {
    if (live.shut[g] === live.want[g]) continue;
    if (live.want[g] === 0 || !overlaps(m, board, board.gates[g])) {
      live.shut[g] = live.want[g];
      events.push({ type: 'gate', i: g, shut: live.shut[g] === 1 });
    }
  }
}

// Does the marble touch this gate's cell at all?
function overlaps(m, board, gate) {
  const x0 = board.x0(gate.c);
  const z0 = board.z0(gate.r);
  const px = Math.max(x0, Math.min(m.x, x0 + 1));
  const pz = Math.max(z0, Math.min(m.z, z0 + 1));
  return Math.hypot(m.x - px, m.z - pz) < C.BALL_R + 0.02;
}
