/*
 * levels.js — the mazes, drawn as text.
 *
 *   #  wall          S  start          O  hole
 *   .  floor         G  goal           (space is floor too)
 *
 *   > < ^ v   kicker: fires the marble that way
 *   @ &       gear, clockwise / anticlockwise from above; the 3×3 round it
 *             must be clear floor
 *   *         switch: flips every gate on the board
 *   = _       gate, shut / open at the start
 *
 * Anything outside the grid counts as wall (sim/board.js), so a level that
 * forgets its border still cannot lose the marble off the edge. The 3D board
 * is generated from these strings: a new level is one entry here and nothing
 * else — then run `node tools/check-levels.mjs`, which proves it can be
 * finished and that no kicker can trap the marble in a pocket.
 *
 * The order teaches. The first two have no holes, because a five-year-old's
 * first minute is for learning that tilting rolls the ball. Each gadget then
 * gets a level to itself before it is combined with anything: kickers at 7,
 * gears at 10, switches at 11.
 */

export const LEVELS = [
  {
    name: 'Roll',
    grid: `
#########
#S......#
#######.#
#.......#
#.#######
#......G#
#########`,
  },
  {
    name: 'Zigzag',
    grid: `
###########
#S#...#...#
#.#.#.#.#.#
#.#.#.#.#.#
#...#...#G#
###########`,
  },
  {
    name: 'Mind the gap',
    grid: `
###########
#S........#
#.......O.#
#######...#
#....O....#
#.........#
#...#######
#.O......G#
#.........#
###########`,
  },
  {
    name: 'Stepping stones',
    grid: `
###########
#S........#
#..O...O..#
#....O....#
#.O.....O.#
#....O....#
#..O...O..#
#........G#
###########`,
  },
  {
    name: 'Long way round',
    grid: `
#############
#S.....#....#
#..O...#.O..#
#####..#..###
#...O.....O.#
#...........#
#..##########
#..O.....O..#
#...........#
#########...#
#G..O.......#
#...........#
#############`,
  },
  {
    name: 'Snail shell',
    grid: `
#############
#S..........#
###########.#
#.........#.#
#.#######.#.#
#.#G....#.#.#
#.#####.#.#.#
#.......#...#
#############`,
  },
  {
    name: 'Kick',
    grid: `
#############
#S.>........#
###########.#
#.........<.#
#.###########
#...O....O..#
#.....O....G#
#############`,
  },
  {
    name: 'Express',
    grid: `
###########
#S..>....v#
#.#######.#
#.#..G..#.#
#.#.###.#.#
#^........#
###########`,
  },
  {
    name: 'Shooting gallery',
    grid: `
#############
#S..........#
#OOOOOOOOOO.#
#...........#
#.OOOOOOOOOO#
#>.........G#
#############`,
  },
  {
    name: 'Merry-go-round',
    grid: `
###########
#S........#
#########.#
#.........#
#..O...O..#
#....@....#
#..O...O..#
#.........#
#.#########
#........G#
###########`,
  },
  {
    name: 'Switchback',
    grid: `
###########
#S........#
#.#######.#
#.#G=...#.#
#.#####.#.#
#*......#.#
###########`,
  },
  {
    name: 'Lock and key',
    grid: `
###########
#S..._.*..#
#########.#
#G..=.....#
###########`,
  },
  {
    name: 'Flip flop',
    grid: `
###########
#S..*..=..#
#########.#
#G._..*...#
###########`,
  },
  {
    name: 'Gearbox',
    grid: `
#############
#S....#...O.#
#.....#.....#
#..@..#..&..#
#...........#
#..O........#
#######.#####
#.....O.....#
#..........G#
#############`,
  },
  {
    name: 'Roundabout',
    grid: `
#############
#S.......O..#
#.###########
#...........#
#.....@.....#
#...........#
#####.#######
#O...>.....G#
#############`,
  },
  {
    name: 'Long shot',
    grid: `
#############
#S..O...O..v#
#.O...O...O.#
#...O...O...#
#.O...O...O.#
#...O...O...#
#.O...O...O.#
#G..........#
#############`,
  },
  {
    name: 'Clockwork',
    grid: `
###############
#S....#.......#
#.....#...&...#
#..@..=.......#
#.....#.......#
#*....#.......#
#######.#######
#G...<..O.....#
###############`,
  },
  {
    name: 'Grand tour',
    grid: `
###############
#S..O.....#...#
#.#...###.#.@.#
#...#..*#.=...#
###.#####.#...#
#.........#..v#
#.####.####.#.#
#...O.....O.#.#
######.##.###.#
#G.=.....<....#
###############`,
  },
];
