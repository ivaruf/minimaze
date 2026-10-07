/*
 * levels.js — the mazes, drawn as text.
 *
 *   #  wall          S  start          O  hole
 *   .  floor         G  goal           (space is floor too)
 *
 *   > < ^ v   kicker: throws the marble that way, over the next two cells
 *             (holes there do not catch it) to land in the third
 *   @ &       gear, clockwise / anticlockwise from above; its hub is a hole,
 *             and the 3×3 round it must be clear floor
 *   *         switch: flips every gate and reverses every gear
 *   = _       gate, shut / open at the start
 *
 * Anything outside the grid counts as wall (sim/board.js), so a level that
 * forgets its border still cannot lose the marble off the edge. The 3D board
 * is generated from these strings: a new level is one entry here and nothing
 * else — then run `node tools/check-levels.mjs`, which proves it can be
 * finished, that no kicker can trap the marble in a pocket, and that every
 * kind of gadget on the board is NEEDED. A gadget you can roll around is
 * decoration, and the owner called that out: trenches only a kicker
 * crosses, gears in walled bands, goals behind gates.
 *
 * The order teaches. The first two have no holes, because a five-year-old's
 * first minute is for learning that tilting rolls the ball. Each gadget then
 * gets levels to itself before it is combined with anything: kickers from 7,
 * gears from 11, switches from 13, then all of them together.
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
    name: 'Hop',
    grid: `
############
#S.........#
#########..#
#G..OO<....#
#...OO<....#
############`,
  },
  {
    name: 'Hopscotch',
    grid: `
##############
#S..>OO......#
##########...#
#....OO<.....#
#..###########
#..>OO......G#
##############`,
  },
  {
    name: 'Over the river',
    grid: `
###########
#S........#
#.......v.#
#OOOOOOOOO#
#OOOOOOOOO#
#.........#
#.........#
#G........#
###########`,
  },
  {
    name: 'Long shot',
    grid: `
#########
#S.>OOv##
#OOOOOOO#
#OOOOOOO#
#G....<.#
#########`,
  },
  {
    name: 'Merry-go-round',
    grid: `
#########
#S......#
#.......#
###...###
###.@.###
###...###
#.......#
#..O.O..#
#G.....O#
#########`,
  },
  {
    name: 'Gearbox',
    grid: `
#############
#S.....######
###...#######
###...#...###
###.@...&.###
###...#...###
#######...###
#G........###
#############`,
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
    name: 'Roundabout',
    grid: `
###########
#S........#
#...v.....#
#OOOOOOOOO#
#OOOOOOOOO#
###.....###
####...####
####.@.####
####...####
#.........#
#.O..O..OG#
###########`,
  },
  {
    name: 'Clockwork',
    grid: `
#############
#S...#......#
#....=......#
#*...#......#
########...##
########...##
########.@.##
########...##
#G.....OO<..#
#############`,
  },
  {
    name: 'Grand tour',
    grid: `
###############
#S....#.O.....#
#.....=...v...#
#*....#OOOOOOO#
#######OOOOOOO#
#######.......#
#######...#####
#######.@.#####
#######...#####
#G....OO<.....#
###############`,
  },
];
