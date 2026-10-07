/*
 * scene.js — renderer, camera, light, and the two groups the board hangs in.
 *
 *   scene
 *   ├─ lights (fixed: the room does not tilt, only the board does, so its
 *   │          shadows slide across the wood as it tips)
 *   └─ turn    rotated about Y when a wide maze meets a tall screen, so the
 *      │       maze fills the screen instead of shrinking into a strip
 *      └─ tilt the board's tilt, in board terms (tz about X, tx about Z)
 *         └─ plank, walls, goal, marble...
 *
 * The camera sits above and in front, looking down at about 60°: steep
 * enough to read the maze like a map, shallow enough that the tilt shows.
 * fit() places it so the whole board is in view at any aspect.
 *
 * Reflections come from three's RoomEnvironment through PMREM, generated
 * once at boot: the steel marble needs something to mirror, and this gives
 * it a soft studio with no image files to ship.
 */

import * as THREE from '../../vendor/three/three.module.js';
import { RoomEnvironment } from '../../vendor/three/addons/environments/RoomEnvironment.js';
import { WALL_H } from '../config.js';

const ELEVATION = (60 * Math.PI) / 180;
const FOV = 34;
const MARGIN = 0.9; // fraction of the screen the board may fill

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // hub §10
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was removed in r186; PCF with a radius is its successor.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d140d);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // The environment is for the marble's mirror; on the wood it would wash out
  // the key light's shadows, so it is kept low and the lights do the work.
  scene.environmentIntensity = 0.45;

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 0.9);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe6c4, 2.6);
  key.position.set(-5, 12, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);
  scene.add(key.target);

  const turn = new THREE.Group();
  const tilt = new THREE.Group();
  turn.add(tilt);
  scene.add(turn);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const camBase = new THREE.Vector3();
  const dir = new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));

  // Scratch for fit(); no allocation once booted.
  const corner = new THREE.Vector3();
  let halfW = 4;
  let halfD = 4;

  /*
   * Size the canvas and place the camera so the board's bounding box, as
   * turned on screen, fills MARGIN of the view. Perspective makes the near
   * edge bigger than the far one, so this measures rather than assumes:
   * project the corners, scale the distance by how far out they land, and
   * repeat; three passes settle it to a pixel.
   */
  function fit(w, h, board, yaw) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    halfW = board.cols / 2;
    halfD = board.rows / 2;
    turn.rotation.y = yaw;

    let dist = Math.max(halfW, halfD) * 3;
    for (let pass = 0; pass < 3; pass++) {
      camera.position.copy(dir).multiplyScalar(dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      let worst = 0;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? halfW : -halfW, i & 2 ? WALL_H : 0, i & 4 ? halfD : -halfD);
        corner.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
        corner.project(camera);
        worst = Math.max(worst, Math.abs(corner.x), Math.abs(corner.y));
      }
      dist *= worst / MARGIN;
    }
    camera.position.copy(dir).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
    camBase.copy(camera.position);

    // The shadow camera covers the board and no more, so its texels are
    // spent where the marble is.
    const r = Math.hypot(halfW, halfD) + 1;
    const sc = key.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 1;
    sc.far = 40;
    sc.updateProjectionMatrix();
  }

  // A knock against a wall nudges the camera, never more than a few
  // hundredths of a cell, and it settles in a fraction of a second.
  let shake = 0;
  function nudge(amount) {
    shake = Math.min(0.06, shake + amount);
  }

  function render(dt) {
    if (shake > 0.0005) {
      shake *= Math.exp(-14 * dt);
      camera.position.set(
        camBase.x + (Math.random() - 0.5) * shake,
        camBase.y + (Math.random() - 0.5) * shake,
        camBase.z + (Math.random() - 0.5) * shake,
      );
    } else if (shake !== 0) {
      shake = 0;
      camera.position.copy(camBase);
    }
    renderer.render(scene, camera);
  }

  return { THREE, renderer, scene, camera, turn, tilt, fit, nudge, render };
}
