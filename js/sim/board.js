/*
 * board.js — turn a level's text grid into the facts the sim and the
 * renderer both read.
 *
 * Coordinates: the board is centred on the origin. Column c, row r has its
 * centre at x = c + 0.5 - cols/2, z = r + 0.5 - rows/2, so +x is right and +z
 * is toward the player (down the screen). Every other module works in these
 * units and never re-derives them.
 *
 * No three.js here: the sim is a plain-data world (DESIGN.md §2).
 */

export function parseBoard(level) {
  const lines = level.grid.split('\n').filter((l) => l.trim().length);
  const rows = lines.length;
  const cols = Math.max(...lines.map((l) => l.length));
  const wall = new Uint8Array(cols * rows);
  const holes = [];
  let start = null;
  let goal = null;

  const cx = (c) => c + 0.5 - cols / 2;
  const cz = (r) => r + 0.5 - rows / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = lines[r][c] || ' ';
      if (ch === '#') wall[r * cols + c] = 1;
      else if (ch === 'O') holes.push({ x: cx(c), z: cz(r) });
      else if (ch === 'S') start = { x: cx(c), z: cz(r) };
      else if (ch === 'G') goal = { x: cx(c), z: cz(r) };
    }
  }
  if (!start || !goal) throw new Error(`level "${level.name}" needs an S and a G`);

  return {
    name: level.name,
    cols,
    rows,
    wall,
    holes,
    start,
    goal,
    // Out of bounds is wall, so a missing border never loses the marble.
    isWall(c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return true;
      return wall[r * cols + c] === 1;
    },
    // World x/z of a cell's left/top edge.
    x0: (c) => c - cols / 2,
    z0: (r) => r - rows / 2,
    cellOf: (x, z) => [Math.floor(x + cols / 2), Math.floor(z + rows / 2)],
  };
}
