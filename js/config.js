/*
 * config.js — every tuning number in MiniMaze, and nothing else.
 *
 * Units are grid cells (one maze square = 1) and seconds. Angles are radians.
 * The physics constants are tuned for feel, not copied from a real board: a
 * real labyrinth square is about 1.5 cm, which at true gravity is ~650
 * cells/s² and far too fast to steer on a phone. What we keep from reality is
 * the *shape* of the motion: gravity along the slope, the rolling factor,
 * a little friction, a dull bounce off wood.
 */

const DEG = Math.PI / 180;

// ---- the board ----
export const WALL_H = 0.55; // how tall a wall stands above the floor
export const BOARD_THICK = 0.35; // the plank the holes are cut through
export const PIT_DEPTH = 1.4; // floor of the dark box under the board

// ---- the marble ----
export const BALL_R = 0.3;
export const HOLE_R = 0.4; // wider than the ball, or it could never drop in
export const GOAL_R = 0.42;

// ---- tilt ----
// Small on purpose: on an iPhone, which cannot lock orientation, tilting far
// enough rotates the page. 15° stays under that in normal play (DESIGN.md §3);
// confirm on a real phone before raising it.
export const MAX_TILT = 15 * DEG;
// How fast the board follows the hand, as an exponential rate (1/s). A real
// board has mass; an instant tilt reads as digital.
export const TILT_EASE = 9;
// Device tilt moves the drawing of the board only this much: the board on
// screen IS the device, so tilting both the picture and the hands doubles the
// motion and makes it hard to read. Drag and keys tilt it fully.
export const VISUAL_TILT_DEVICE = 0.35;
// One degree of device equals this many degrees of board.
export const DEVICE_GAIN = 1.0;
// Drag: a drag of this fraction of the shorter screen side is full tilt.
export const DRAG_FULL = 0.22;
export const PAD_DEADZONE = 0.15;

// ---- physics ----
export const STEP = 1 / 120; // fixed step
export const MAX_STEPS = 8; // per frame, so a stalled tab does not spiral
export const GRAVITY = 42;
// A solid sphere rolling without slipping accelerates at 5/7 of a sliding
// puck, because some of the energy goes into spin. It is why a marble feels
// heavy; leaving it out makes it feel like ice.
export const ROLL_FACTOR = 5 / 7;
export const ROLL_FRICTION = 0.8; // constant deceleration while moving, cells/s²
export const DAMPING = 0.25; // proportional drag, 1/s
export const MAX_SPEED = 11; // cells/s
export const RESTITUTION = 0.35; // a dull bounce: wood, not rubber
export const WALL_EVENT_MIN = 0.6; // impacts slower than this are silent
// Near a hole's lip the marble is drawn toward its centre, which is what a
// real chamfered hole does and what makes a near miss feel like a near miss.
export const RIM_EXTRA = 0.18; // pull zone beyond HOLE_R
export const RIM_PULL = 9; // cells/s² at the very edge of the hole

// No tunnelling, and therefore no swept collision, as long as one step never
// moves the marble further than its radius. Checked here so a tuning change
// that breaks it fails loudly at load rather than as a ghost through a wall.
if (MAX_SPEED * STEP >= BALL_R * 0.5) {
  throw new Error('config: MAX_SPEED * STEP must stay well under BALL_R');
}

// ---- moments ----
export const FALL_TIME = 0.55; // drop into a hole
export const SPAWN_TIME = 0.3; // pop back out at the start
export const GOAL_TIME = 0.9; // sink into the goal before the card

// ---- gadgets (sim/gadgets.js) ----
export const LAUNCH_SPEED = 10; // a kicker's shot, cells/s; under MAX_SPEED
// A kicker throws the marble into the air: it flies LAUNCH_SPEED × HOP_TIME
// = 3 cells from the pad's centre, clearing the two cells after the pad and
// landing in the third. Holes under the flight do not catch it. That is the
// kicker's whole reason to exist: a trench of holes only a kicker crosses.
// tools/check-levels.mjs models exactly this, so change both together.
export const HOP_TIME = 0.3;
export const HOP_HEIGHT = 0.6; // drawn arc only; the sim is 2D
// A landing is a thump: the marble keeps only this much of its speed.
// Without it a throw that lands near a wall bounced straight back across
// the trench it had just cleared.
export const LAND_KEEP = 0.5;
export const PAD_TRIGGER = 0.3; // centre within this of a pad's centre: fire
export const PAD_REARM = 0.6; // and it re-arms once the marble is this far off
export const GEAR_R = 1.35; // a gear covers the 3×3 cells round its hub
export const GEAR_SPIN = 1.7; // rad/s; a switch reverses every gear
// How hard the moving floor drags the marble, 1/s. Strong enough that you
// ride a gear rather than roll across it: tilt can still steer you on it
// (about 1 cell/s of slip at full tilt) but not stop it carrying you.
export const GEAR_GRIP = 7;
