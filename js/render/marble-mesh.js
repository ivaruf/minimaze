/*
 * marble-mesh.js — the steel ball, drawn from the sim's state.
 *
 * The sim knows a position, a velocity and a mode. This adds what only the
 * eye needs:
 *
 *   SPIN   derived from distance travelled (angle = distance / radius about
 *          the axis perpendicular to motion), accumulated as a quaternion so
 *          it never gimbals. On polished steel spin barely shows, which is
 *          true of the real toy too; the speckle map below exists so it does
 *          show a little.
 *   SPAWN  a quick swell out of the start ring.
 *   FALL   slide to the hole's centre while dropping, accelerating, into
 *          the dark under the board.
 *   GOAL   the same drop, ending at rest on the lit floor of the cup.
 *   HOP    after a kicker, a parabola over the flight; the shadow on the
 *          board below is what makes it read as a jump.
 */

import * as THREE from '../../vendor/three/three.module.js';
import { BALL_R, PIT_DEPTH, FALL_TIME, SPAWN_TIME, GOAL_TIME, HOP_TIME, HOP_HEIGHT } from '../config.js';

export function createMarbleMesh() {
  const geo = new THREE.SphereGeometry(BALL_R, 48, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe6e9ee,
    metalness: 1,
    roughness: 0.14,
    roughnessMap: speckle(),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  // Scratch, reused every frame.
  const axis = new THREE.Vector3();
  const dq = new THREE.Quaternion();
  let lastX = 0;
  let lastZ = 0;

  function place(m, cupY) {
    let x = m.x;
    let z = m.z;
    let y = BALL_R;
    let s = 1;

    if (m.air > 0) {
      const u = 1 - m.air / HOP_TIME;
      y += 4 * HOP_HEIGHT * u * (1 - u);
    }

    if (m.mode === 'spawn') {
      const t = Math.min(1, m.t / SPAWN_TIME);
      s = backOut(t);
    } else if ((m.mode === 'fall' || m.mode === 'goal') && m.into) {
      const dur = m.mode === 'goal' ? GOAL_TIME : FALL_TIME;
      const t = Math.min(1, m.t / dur);
      // Centre over the opening quickly, then drop.
      const slide = Math.min(1, t * 3);
      x = m.x + (m.into.x - m.x) * slide;
      z = m.z + (m.into.z - m.z) * slide;
      const floor = m.mode === 'goal' ? cupY : -PIT_DEPTH + BALL_R;
      const fallT = m.mode === 'goal' ? Math.min(1, t * 2.2) : t;
      y = BALL_R + (floor - BALL_R) * fallT * fallT;
    }

    // Roll by the distance actually moved on screen this frame.
    const dx = x - lastX;
    const dz = z - lastZ;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-5 && dist < 1) {
      axis.set(dz / dist, 0, -dx / dist); // up × direction of motion
      dq.setFromAxisAngle(axis, dist / BALL_R);
      mesh.quaternion.premultiply(dq);
    }
    lastX = x;
    lastZ = z;

    mesh.position.set(x, y, z);
    mesh.scale.setScalar(s);
  }

  return {
    mesh,
    place,
    // After a respawn the jump from hole to start is not a roll.
    snap(m) {
      lastX = m.x;
      lastZ = m.z;
    },
  };
}

function backOut(t) {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

// A faint, fine roughness variation: enough that the ball's turning catches
// the light, not so much that it stops looking polished.
function speckle() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#262626';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const v = 30 + Math.floor(Math.random() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
