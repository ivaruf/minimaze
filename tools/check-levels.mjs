#!/usr/bin/env node
/*
 * check-levels.mjs — prove every maze is fair, and that its gadgets matter.
 *
 *   node tools/check-levels.mjs
 *
 * Three things must hold for every level, and the run exits non-zero if any
 * does not:
 *
 *   SOLVABLE   the goal is reachable from the start
 *   NO TRAPS   from EVERY reachable spot the goal is still reachable,
 *              without counting on deliberately dropping into a hole. A
 *              kicker in a narrow corridor is a one-way door, and a level
 *              drawn by eye can easily let the marble into a pocket it can
 *              never leave; a five-year-old stuck there has no idea why.
 *   NEEDED     every kind of gadget on the board is required: take it away
 *              (kickers become plain floor, switches become plain floor,
 *              gears become holes) and the level must become impossible.
 *              The owner's verdict on the first gadget levels was that you
 *              could just roll around the gears "and you don't really have
 *              to engage with the mechanics". This is that rule, enforced.
 *
 * The model is a grid abstraction of the physics in js/sim/, deliberately
 * cautious:
 *   - a move goes one cell; walls and shut gates block it; a hole, or a
 *     gear's hub, is never entered (falling is a reset, not a route)
 *   - a switch flips every gate when entered
 *   - a kicker throws: the two cells after it are flown over (holes there
 *     do not matter, a wall stops the flight early), the marble lands in
 *     the third, then keeps sliding the same way until something solid
 *     stops it, taking anything on the floor as it goes (holes, switches,
 *     more kickers, the goal). config.js HOP_TIME is set so the sim lands
 *     exactly there.
 *   - a gear's ring is floor; its spin is not modelled, so a pass means
 *     the route exists, and riding it is the player's job
 * State is (cell, gates flipped or not), at most 2 × cells states.
 *
 * Prints the shortest route through each maze, a rough guide when ordering
 * them by difficulty.
 */

import { LEVELS } from '../js/levels.js';

const KICK = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AIR = 2; // cells flown over after a kicker; landing is the next
const WIN = -1;

function solve(rows) {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? '#' : rows[r][c] || '.');
  let start = null;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === 'S') start = [c, r];

  const shut = (ch, f) => (ch === '=' ? !f : ch === '_' ? f : false);
  const solid = (c, r, f) => at(c, r) === '#' || shut(at(c, r), f);
  const pit = (ch) => ch === 'O' || ch === '@' || ch === '&';
  const key = (c, r, f) => (r * W + c) * 2 + (f ? 1 : 0);

  // The marble arrives on (c, r) along the floor. Where does it end up?
  // Returns [c, r, f], WIN, or null for a fall.
  function enter(c, r, f, depth = 0) {
    if (depth > 64) return null; // kickers throwing in a circle
    const ch = at(c, r);
    if (pit(ch)) return null;
    if (ch === 'G') return WIN;
    if (ch === '*') f = !f;
    const k = KICK[ch];
    return k ? toss(c, r, k[0], k[1], f, depth) : [c, r, f];
  }

  function toss(c, r, dx, dz, f, depth) {
    // Fly over AIR cells; a wall ends the flight early and the marble drops
    // where it is.
    for (let i = 1; i <= AIR; i++) {
      if (solid(c + dx, r + dz, f)) return i === 1 ? [c, r, f] : enter(c, r, f, depth + 1);
      c += dx;
      r += dz;
    }
    // Landing, then the slide.
    for (;;) {
      if (solid(c + dx, r + dz, f)) return enter(c, r, f, depth + 1);
      c += dx;
      r += dz;
      const ch = at(c, r);
      if (pit(ch)) return null;
      if (ch === 'G') return WIN;
      if (ch === '*') f = !f;
      if (KICK[ch]) return toss(c, r, KICK[ch][0], KICK[ch][1], f, depth + 1);
    }
  }

  const edges = new Map();
  const dist = new Map();
  const s0 = [start[0], start[1], false];
  const q = [s0];
  dist.set(key(...s0), 0);
  let best = Infinity;
  while (q.length) {
    const s = q.shift();
    const ks = key(...s);
    const list = [];
    for (const [dx, dz] of DIRS) {
      if (solid(s[0] + dx, s[1] + dz, s[2])) continue;
      const res = enter(s[0] + dx, s[1] + dz, s[2]);
      if (res) list.push(res);
    }
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

  // Which reachable states can still get to the goal?
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
  const traps = [...edges.keys()].filter((k) => !good.has(k));
  return { W, H, best, states: edges.size, traps };
}

// Ways to take a kind of gadget away, for the NEEDED rule.
const WITHOUT = {
  kicker: (rows) => rows.map((r) => r.replace(/[><^v]/g, '.')),
  switch: (rows) => rows.map((r) => r.replace(/\*/g, '.')),
  gear: (rows) => {
    const g = rows.map((r) => r.split(''));
    rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '@' && ch !== '&') return;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) g[r + dr][c + dc] = 'O';
      }),
    );
    return g.map((r) => r.join(''));
  },
};
const HAS = { kicker: /[><^v]/, switch: /\*/, gear: /[@&]/ };

let failures = 0;
LEVELS.forEach((level, li) => {
  const rows = level.grid.split('\n').filter((l) => l.trim().length);
  const problems = [];

  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '@' && ch !== '&') return;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          if ('#=_O@&'.includes((rows[r + dr] || '')[c + dc] || '#'))
            problems.push(`gear at ${c},${r} needs clear floor all round it`);
        }
    }),
  );

  const res = solve(rows);
  if (res.best === Infinity) problems.push('the goal cannot be reached');
  else if (res.traps.length) {
    const shown = res.traps.slice(0, 4).map((k) => {
      const cell = k >> 1;
      return `${cell % res.W},${Math.floor(cell / res.W)}${k & 1 ? ' (flipped)' : ''}`;
    });
    problems.push(`${res.traps.length} trap state(s), e.g. ${shown.join('; ')}`);
  }

  const kinds = Object.keys(HAS).filter((k) => rows.some((r) => HAS[k].test(r)));
  for (const kind of kinds) {
    if (solve(WITHOUT[kind](rows)).best !== Infinity) problems.push(`the ${kind}s can be avoided`);
  }

  const label = `${String(li + 1).padStart(2)}. ${level.name}`.padEnd(28);
  if (problems.length) {
    failures++;
    console.log(`${label} FAIL`);
    for (const p of [...new Set(problems)]) console.log(`      ${p}`);
  } else {
    const uses = kinds.length ? `  needs: ${kinds.join(', ')}` : '';
    console.log(`${label} ok   ${res.W}×${res.H}, route ${res.best}${uses}`);
  }
});

if (failures) {
  console.log(`\n${failures} level(s) failed`);
  process.exit(1);
}
