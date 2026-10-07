#!/usr/bin/env node
/*
 * check-levels.mjs — prove every maze can be finished, and cannot trap you.
 *
 *   node tools/check-levels.mjs
 *
 * Kickers make this necessary: in a one-wide corridor a kicker is a one-way
 * valve, and a level drawn by eye can easily let the marble into a pocket
 * whose only exit fires it back in. A five-year-old stuck there has no idea
 * why. So every level is searched as a grid puzzle, and two things must
 * hold:
 *
 *   SOLVABLE   the goal is reachable from the start
 *   NO TRAPS   from EVERY reachable spot, the goal is still reachable,
 *              without counting on deliberately dropping into a hole
 *
 * The model is a grid abstraction of the physics, deliberately cautious:
 *   - a step moves one cell; walls and shut gates block it
 *   - a hole is never entered (falling is a reset, not a route)
 *   - entering a kicker forces a slide in its direction until something
 *     stops it; the slide trips any switch it crosses, turns at any kicker
 *     it meets, drops into any hole on its line (so that whole shot is not a
 *     route), and finishes on the goal if it crosses the goal
 *   - entering a switch flips every gate
 *   - a gear is floor (it flings, but you can ride it out with tilt)
 * State is (cell, gates flipped or not), so at most 2 × cells states.
 *
 * Exits non-zero on any failure, and prints the length of the shortest
 * route through each maze, a rough guide when ordering them by difficulty.
 */

import { LEVELS } from '../js/levels.js';

const KICK = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

let failures = 0;

LEVELS.forEach((level, li) => {
  const rows = level.grid.split('\n').filter((l) => l.trim().length);
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? '#' : rows[r][c] || '.');
  let start = null;
  const problems = [];
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const ch = at(c, r);
      if (ch === 'S') start = [c, r];
      if (ch === '@' || ch === '&') {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if ('#=_O'.includes(at(c + dc, r + dr))) problems.push(`gear at ${c},${r} needs clear floor around it`);
      }
    }

  const shut = (ch, f) => (ch === '=' ? !f : ch === '_' ? f : false);
  const solid = (c, r, f) => at(c, r) === '#' || shut(at(c, r), f);
  const key = (c, r, f) => (r * W + c) * 2 + (f ? 1 : 0);
  const WIN = -1;

  // Where does stepping onto (c, r) with gates `f` actually leave the
  // marble? Returns [c, r, f], WIN, or null (fell in a hole).
  function land(c, r, f) {
    let guard = 0;
    for (;;) {
      if (guard++ > W * H * 4) return null; // kickers firing in a circle
      const ch = at(c, r);
      if (ch === 'O') return null;
      if (ch === 'G') return WIN;
      if (ch === '*') f = !f;
      const k = KICK[ch];
      if (!k) return [c, r, f];
      // Slide until the next cell is solid.
      let [dx, dz] = k;
      for (;;) {
        const nc = c + dx;
        const nr = r + dz;
        if (solid(nc, nr, f)) return [c, r, f];
        c = nc;
        r = nr;
        const t = at(c, r);
        if (t === 'O') return null;
        if (t === 'G') return WIN;
        if (t === '*') f = !f;
        if (KICK[t]) break; // re-enter the outer loop and take its direction
      }
    }
  }

  function next(c, r, f) {
    const out = [];
    for (const [dx, dz] of DIRS) {
      const nc = c + dx;
      const nr = r + dz;
      if (solid(nc, nr, f)) continue;
      const res = land(nc, nr, f);
      if (res) out.push(res);
    }
    return out;
  }

  // Forward search from the start, recording the graph.
  const edges = new Map();
  const dist = new Map();
  const s0 = [start[0], start[1], false];
  const q = [s0];
  dist.set(key(...s0), 0);
  let best = Infinity;
  while (q.length) {
    const s = q.shift();
    const ks = key(...s);
    const list = next(...s);
    edges.set(ks, list);
    for (const n of list) {
      if (n === WIN) {
        best = Math.min(best, dist.get(ks) + 1);
        continue;
      }
      const kn = key(...n);
      if (!dist.has(kn)) {
        dist.set(kn, dist.get(ks) + 1);
        q.push(n);
      }
    }
  }

  // Backward: which reachable states can still get to the goal?
  const good = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [ks, list] of edges) {
      if (good.has(ks)) continue;
      if (list.some((n) => n === WIN || good.has(key(...n)))) {
        good.add(ks);
        changed = true;
      }
    }
  }

  if (best === Infinity) problems.push('the goal cannot be reached');
  const traps = [...edges.keys()].filter((k) => !good.has(k));
  if (traps.length && best !== Infinity) {
    const shown = traps.slice(0, 4).map((k) => {
      const cell = k >> 1;
      return `${cell % W},${Math.floor(cell / W)}${k & 1 ? ' (flipped)' : ''}`;
    });
    problems.push(`${traps.length} trap state(s), e.g. ${shown.join('; ')}`);
  }

  const label = `${String(li + 1).padStart(2)}. ${level.name}`.padEnd(30);
  if (problems.length) {
    failures++;
    console.log(`${label} FAIL`);
    for (const p of problems) console.log(`      ${p}`);
  } else {
    console.log(`${label} ok   ${W}×${H}, shortest route ${best} moves, ${edges.size} states`);
  }
});

if (failures) {
  console.log(`\n${failures} level(s) failed`);
  process.exit(1);
}
