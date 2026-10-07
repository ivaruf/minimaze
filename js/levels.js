/*
 * levels.js — the mazes, drawn as text.
 *
 *   #  wall          S  start
 *   .  floor         G  goal
 *   O  hole          (space is floor too, so rows may be ragged)
 *
 * Anything outside the grid counts as wall (sim/board.js), so a level that
 * forgets its border still cannot lose the marble off the edge. The 3D board
 * is generated from these strings: a new level is one entry here and nothing
 * else.
 *
 * M1 carries three, enough to judge feel (DESIGN.md §8). The first has no
 * holes at all: a five-year-old's first thirty seconds are for learning that
 * tilting rolls the ball, and nothing should punish him for it.
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
];
