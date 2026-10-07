/*
 * board.js — turn a level's text grid into the facts the sim and the
 * renderer both read.
 *
 * Coordinates: the board is centred on the origin. Column c, row r has its
 * centre at x = c + 0.5 - cols/2, z = r + 0.5 - rows/2, so +x is right and +z
 * is toward the player (down the screen). Every other module works in these
 * units and never re-derives them.
 *
 * The board is static except for one field, `live`: the gadgets' moving
 * parts (which gates are shut, which pads are armed, how far the gears have
 * turned). sim/gadgets.js owns it and resets it on every respawn, so a fall
 * always puts the whole board back as the level began. A level is parsed
 * fresh each time it loads, so nothing leaks between levels.
 *
 * No three.js here: the sim is a plain-data world (DESIGN.md §2).
 */

// Kicker glyphs and the direction each one fires.
const KICK = {
  '>': [1, 0],
  '<': [-1, 0],
  '^': [0, -1],
  v: [0, 1],
};

export function parseBoard(level) {
  const lines = level.grid.split('\n').filter((l) => l.trim().length);
  const rows = lines.length;
  const cols = Math.max(...lines.map((l) => l.length));
  const wall = new Uint8Array(cols * rows);
  const gateAt = new Int16Array(cols * rows).fill(-1);
  const holes = [];
  const kickers = [];
  const gears = [];
  const switches = [];
  const gates = [];
  let start = null;
  let goal = null;

  const cx = (c) => c + 0.5 - cols / 2;
  const cz = (r) => r + 0.5 - rows / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c] || ' ';
      const at = { x: cx(c), z: cz(r) };
      if (ch === '#') wall[r * cols + c] = 1;
      else if (ch === 'O') holes.push(at);
      else if (ch === 'S') start = at;
      else if (ch === 'G') goal = at;
      else if (KICK[ch]) kickers.push({ ...at, dx: KICK[ch][0], dz: KICK[ch][1] });
      else if (ch === '@' || ch === '&') gears.push({ ...at, spin: ch === '@' ? 1 : -1 });
      else if (ch === '*') switches.push(at);
      else if (ch === '=' || ch === '_') {
        gateAt[r * cols + c] = gates.length;
        gates.push({ ...at, c, r, shut: ch === '=' });
      }
    }
  }
  if (!start || !goal) throw new Error(`level "${level.name}" needs an S and a G`);

  const board = {
    name: level.name,
    cols,
    rows,
    wall,
    holes,
    start,
    goal,
    kickers,
    gears,
    switches,
    gates,
    live: null, // sim/gadgets.js fills this in
    // Out of bounds is wall, so a missing border never loses the marble. A
    // shut gate is wall too, which is all the collision code needs to know.
    isWall(c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return true;
      const i = r * cols + c;
      if (wall[i] === 1) return true;
      const g = gateAt[i];
      return g >= 0 && board.live.shut[g] === 1;
    },
    // World x/z of a cell's left/top edge.
    x0: (c) => c - cols / 2,
    z0: (r) => r - rows / 2,
    cellOf: (x, z) => [Math.floor(x + cols / 2), Math.floor(z + rows / 2)],
  };
  return board;
}
