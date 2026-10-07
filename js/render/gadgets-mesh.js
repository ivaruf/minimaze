/*
 * gadgets-mesh.js — what the board's moving parts look like.
 *
 * The sim (sim/gadgets.js) decides everything; this only draws it, from
 * board.live and from the events the sim emits. Same materials as the
 * board: brass for anything mechanical, the dark wood for anything that is
 * part of the maze.
 *
 *   KICKER  a recessed walnut plate with two brass chevrons pointing the
 *           way it fires. When it fires the chevrons jab forward.
 *   GEAR    a brass gear set flush in the floor, sixteen teeth and five
 *           lightening holes so the turning reads at a glance, turning at
 *           the speed the sim says it does.
 *   SWITCH  a brass collar round an enamel button: red while the gates are
 *           as the level began, green once flipped. It sinks while the
 *           marble sits on it.
 *   GATE    a block of the wall's own wood with a brass cap, sliding out of
 *           and back into the plank. Below the plank's top face it is
 *           simply hidden by the wood, so no slot needs cutting.
 *
 * Nothing allocates per frame; dispose() frees what build made.
 */

import * as THREE from '../../vendor/three/three.module.js';
import { WALL_H, GEAR_R, BALL_R } from '../config.js';
import { woods } from './board-mesh.js';

const GATE_DOWN = -(WALL_H + 0.08);

export function createGadgets(board, renderer) {
  const { dark } = woods(renderer);
  const group = new THREE.Group();
  const owned = [];
  const own = (x) => (owned.push(x), x);

  const brass = own(new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.3 }));
  // Flat brass mirrors one direction of the room and goes olive at full
  // metalness, so plates and caps get a part-metal brass that reads as
  // brass from above; the curved goal ring keeps the true mirror.
  const brassFlat = own(new THREE.MeshStandardMaterial({ color: 0xe0b050, metalness: 0.55, roughness: 0.38 }));
  const brassDim = own(new THREE.MeshStandardMaterial({ color: 0x9a7228, metalness: 1, roughness: 0.45 }));
  const walnut = own(new THREE.MeshStandardMaterial({ color: 0x3b2312, roughness: 0.75 }));

  // ---- kickers ----
  const plateGeo = own(new THREE.BoxGeometry(0.84, 0.02, 0.84));
  const chevronGeo = own(flat(chevronShape(), 0.035));
  const kicks = board.kickers.map((k) => {
    const g = new THREE.Group();
    g.position.set(k.x, 0, k.z);
    g.rotation.y = Math.atan2(-k.dz, k.dx); // shape points +x; turn it to fire
    const plate = new THREE.Mesh(plateGeo, walnut);
    plate.position.y = -0.006;
    plate.receiveShadow = true;
    g.add(plate);
    const arrows = new THREE.Group();
    for (const off of [-0.16, 0.12]) {
      const c = new THREE.Mesh(chevronGeo, brassFlat);
      c.position.x = off;
      c.castShadow = true;
      arrows.add(c);
    }
    g.add(arrows);
    group.add(g);
    return { arrows, t: 0 };
  });

  // ---- gears ----
  const gearGeo = own(flat(gearShape(GEAR_R + 0.05, 16), 0.03));
  const hubGeo = own(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20));
  const gears = board.gears.map((gr) => {
    const g = new THREE.Group();
    g.position.set(gr.x, 0, gr.z);
    const disc = new THREE.Mesh(gearGeo, brassFlat);
    disc.receiveShadow = true;
    g.add(disc);
    const hub = new THREE.Mesh(hubGeo, brassDim);
    hub.position.y = 0.0;
    g.add(hub);
    group.add(g);
    return { g, spin: gr.spin };
  });

  // ---- switches ----
  const collarGeo = own(new THREE.CylinderGeometry(0.36, 0.39, 0.05, 28));
  const buttonGeo = own(new THREE.CylinderGeometry(0.24, 0.26, 0.09, 28));
  const enamel = own(
    new THREE.MeshStandardMaterial({ color: 0xc0412d, roughness: 0.35, emissive: 0x5a1208, emissiveIntensity: 0.6 }),
  );
  const RED = new THREE.Color(0xc0412d);
  const RED_GLOW = new THREE.Color(0x5a1208);
  const GREEN = new THREE.Color(0x4fae4c);
  const GREEN_GLOW = new THREE.Color(0x13450f);
  const switches = board.switches.map((s) => {
    const collar = new THREE.Mesh(collarGeo, brassFlat);
    collar.position.set(s.x, 0.0, s.z);
    collar.receiveShadow = true;
    group.add(collar);
    const button = new THREE.Mesh(buttonGeo, enamel);
    button.position.set(s.x, 0.04, s.z);
    button.castShadow = true;
    group.add(button);
    return { button, x: s.x, z: s.z, press: 0 };
  });

  // ---- gates ----
  const blockGeo = own(new THREE.BoxGeometry(1, WALL_H, 1));
  const capGeo = own(new THREE.BoxGeometry(1.0, 0.06, 1.0));
  const gateWood = own(new THREE.MeshStandardMaterial({ map: dark, color: 0xc8b0a0, roughness: 0.55 }));
  const gates = board.gates.map((gt, i) => {
    const g = new THREE.Group();
    const block = new THREE.Mesh(blockGeo, gateWood);
    block.position.y = WALL_H / 2;
    block.castShadow = block.receiveShadow = true;
    g.add(block);
    const cap = new THREE.Mesh(capGeo, brassFlat);
    cap.position.y = WALL_H + 0.01;
    cap.castShadow = true;
    g.add(cap);
    const up = board.live.shut[i] === 1;
    g.position.set(gt.x, up ? 0 : GATE_DOWN, gt.z);
    group.add(g);
    return g;
  });

  function onEvent(e) {
    if (e.type === 'kick') kicks[e.i].t = 1;
  }

  function update(m, dt) {
    const live = board.live;

    for (let i = 0; i < kicks.length; i++) {
      const k = kicks[i];
      if (k.t <= 0) continue;
      k.t = Math.max(0, k.t - dt * 5);
      // A jab: out fast, back slower.
      k.arrows.position.x = Math.sin(k.t * Math.PI) * 0.18;
    }

    for (let i = 0; i < gears.length; i++) {
      // rotation.y > 0 turns +x toward -z, which is anticlockwise as seen
      // from above with z down the screen; clockwise is negative.
      gears[i].g.rotation.y = -gears[i].spin * live.turn;
    }

    const flipped = live.flipped;
    enamel.color.copy(flipped ? GREEN : RED);
    enamel.emissive.copy(flipped ? GREEN_GLOW : RED_GLOW);
    for (let i = 0; i < switches.length; i++) {
      const s = switches[i];
      const on = m.mode === 'roll' && Math.hypot(m.x - s.x, m.z - s.z) < BALL_R + 0.15;
      s.press += ((on ? 1 : 0) - s.press) * Math.min(1, dt * 18);
      s.button.position.y = 0.04 - s.press * 0.05;
    }

    for (let i = 0; i < gates.length; i++) {
      const want = live.shut[i] === 1 ? 0 : GATE_DOWN;
      const g = gates[i];
      g.position.y += (want - g.position.y) * Math.min(1, dt * 10);
    }
  }

  return {
    group,
    onEvent,
    update,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

// A Shape extruded into a thin plate lying flat, top face at y = 0, shape
// +x along world +x and shape +y along world -z.
function flat(shape, depth) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth + 0.012, 0);
  return geo;
}

function chevronShape() {
  const s = new THREE.Shape();
  s.moveTo(0.16, 0);
  s.lineTo(-0.06, 0.26);
  s.lineTo(-0.18, 0.26);
  s.lineTo(0.03, 0);
  s.lineTo(-0.18, -0.26);
  s.lineTo(-0.06, -0.26);
  s.lineTo(0.16, 0);
  return s;
}

function gearShape(tip, teeth) {
  const root = tip - 0.13;
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Each tooth: rise, top, fall, gap — a quarter of its pitch each.
    const r = i % 4 === 1 || i % 4 === 2 ? tip : root;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.24, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}
