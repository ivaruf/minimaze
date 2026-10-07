/*
 * board-mesh.js — the wooden board, built from a parsed level.
 *
 * Everything here is generated from the grid, so a new level needs no art
 * (DESIGN.md §6):
 *
 *   plank   an extruded Shape with every hole cut as a real opening, so the
 *           marble visibly drops *through* the board rather than onto a
 *           painted spot
 *   walls   one InstancedMesh, one box per wall cell, one draw call
 *   pit     a dark floor under the board that the holes look down into
 *   goal    a brass ring at the lip, and a warm light down in the cup so
 *           the way out is the one bright thing on the board
 *   start   a ring pressed into the wood, so the marble's home is visible
 *
 * The wood grain is painted onto a canvas at boot. No image files, nothing
 * fetched; it is close to what make-icons.py does for icons.
 *
 * build() returns a Group and a dispose(), because a level change throws the
 * whole board away and GPU memory does not collect itself.
 */

import * as THREE from '../../vendor/three/three.module.js';
import { WALL_H, BOARD_THICK, PIT_DEPTH, HOLE_R, GOAL_R, BALL_R } from '../config.js';

// Textures are shared by every board and made once.
let woodLight = null;
let woodDark = null;

export function buildBoard(board, renderer) {
  if (!woodLight) {
    const aniso = renderer.capabilities.getMaxAnisotropy();
    woodLight = woodTexture('#d9a86a', '#b07a40', 1, aniso);
    woodDark = woodTexture('#7a4a26', '#4f2d14', 2, aniso);
  }

  const group = new THREE.Group();
  const owned = []; // geometries and materials to dispose with the level

  const W = board.cols;
  const D = board.rows;

  // ---- plank ----
  // Shape space is x right, y up; after the rotation below, shape y becomes
  // world -z, so a hole at world (x, z) is cut at shape (x, -z).
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -D / 2);
  shape.lineTo(W / 2, -D / 2);
  shape.lineTo(W / 2, D / 2);
  shape.lineTo(-W / 2, D / 2);
  shape.lineTo(-W / 2, -D / 2);
  const cut = (x, z, r) => {
    const p = new THREE.Path();
    p.absarc(x, -z, r, 0, Math.PI * 2, true);
    shape.holes.push(p);
  };
  for (const h of board.holes) cut(h.x, h.z, HOLE_R);
  cut(board.goal.x, board.goal.z, GOAL_R);

  const plankGeo = new THREE.ExtrudeGeometry(shape, {
    depth: BOARD_THICK,
    bevelEnabled: false,
    curveSegments: 28,
  });
  plankGeo.rotateX(-Math.PI / 2); // extrusion now points up
  plankGeo.translate(0, -BOARD_THICK, 0); // top face at y = 0
  // ExtrudeGeometry's cap UVs are shape coordinates in cells; one texture
  // tile across ~6 cells keeps the grain at a believable scale.
  const top = new THREE.MeshStandardMaterial({ map: tiled(woodLight, 1 / 6), roughness: 0.62, metalness: 0 });
  const side = new THREE.MeshStandardMaterial({ color: 0x5a3519, roughness: 0.8 });
  const plank = new THREE.Mesh(plankGeo, [top, side]);
  plank.receiveShadow = true;
  group.add(plank);
  owned.push(plankGeo, top, side);

  // ---- walls ----
  let count = 0;
  for (let i = 0; i < board.wall.length; i++) count += board.wall[i];
  const wallGeo = new THREE.BoxGeometry(1, WALL_H, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.55 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, count);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < D; r++) {
    for (let c = 0; c < W; c++) {
      if (!board.wall[r * W + c]) continue;
      m.makeTranslation(board.x0(c) + 0.5, WALL_H / 2, board.z0(r) + 0.5);
      walls.setMatrixAt(k++, m);
    }
  }
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);
  owned.push(wallGeo, wallMat);

  // ---- pit ----
  // A touch smaller than the plank, so it never peeks out under an edge.
  const pitGeo = new THREE.PlaneGeometry(W - 0.1, D - 0.1);
  pitGeo.rotateX(-Math.PI / 2);
  const pitMat = new THREE.MeshBasicMaterial({ color: 0x080503 });
  const pit = new THREE.Mesh(pitGeo, pitMat);
  pit.position.y = -PIT_DEPTH;
  group.add(pit);
  owned.push(pitGeo, pitMat);

  // ---- goal ----
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.28 });
  const ringGeo = new THREE.TorusGeometry(GOAL_R + 0.03, 0.055, 12, 40);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, brass);
  ring.position.set(board.goal.x, 0.02, board.goal.z);
  ring.castShadow = true;
  group.add(ring);
  // The cup: a glowing floor just under the plank, and a small light so the
  // hole's own walls catch it. The marble comes to rest on this disc.
  const cupGeo = new THREE.CircleGeometry(GOAL_R + 0.02, 32);
  cupGeo.rotateX(-Math.PI / 2);
  const cupMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const cup = new THREE.Mesh(cupGeo, cupMat);
  cup.position.set(board.goal.x, -BOARD_THICK - 0.01, board.goal.z);
  group.add(cup);
  const glow = new THREE.PointLight(0xffb150, 2.2, 2.2, 1.6);
  glow.position.set(board.goal.x, -BOARD_THICK * 0.4, board.goal.z);
  group.add(glow);
  owned.push(brass, ringGeo, cupGeo, cupMat);

  // ---- start ----
  const startGeo = new THREE.TorusGeometry(BALL_R + 0.08, 0.025, 8, 32);
  startGeo.rotateX(Math.PI / 2);
  const startMat = new THREE.MeshStandardMaterial({ color: 0x6b4122, roughness: 0.9 });
  const start = new THREE.Mesh(startGeo, startMat);
  start.position.set(board.start.x, 0.004, board.start.z);
  group.add(start);
  owned.push(startGeo, startMat);

  return {
    group,
    // Where the marble rests once it has sunk into the cup.
    cupY: -BOARD_THICK - 0.01 + BALL_R,
    dispose() {
      for (const o of owned) o.dispose();
      walls.dispose();
      // tiled() clones carry their own texture objects, sharing the image.
      top.map.dispose();
    },
  };
}

function tiled(tex, repeat) {
  const t = tex.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

/*
 * Paint wood: a base, a few hundred thin grain lines that wander with two
 * stacked sines, and the odd darker streak. Seeded so every board's grain is
 * the same between visits; Math.random would do no harm here, but a board
 * that looks different every reload reads as a different board.
 */
function woodTexture(base, grain, seed, aniso) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  let s = seed * 2654435761;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  g.strokeStyle = grain;
  for (let i = 0; i < 220; i++) {
    const y0 = rnd() * S;
    const a1 = 2 + rnd() * 6;
    const a2 = 1 + rnd() * 3;
    const f1 = (Math.PI * 2 * (1 + Math.floor(rnd() * 2))) / S;
    const f2 = (Math.PI * 2 * (3 + Math.floor(rnd() * 4))) / S;
    const p1 = rnd() * 6.28;
    g.globalAlpha = 0.05 + rnd() * 0.18;
    g.lineWidth = 0.6 + rnd() * 1.8;
    g.beginPath();
    for (let x = 0; x <= S; x += 8) {
      const y = y0 + Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2) * a2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  return tex;
}
