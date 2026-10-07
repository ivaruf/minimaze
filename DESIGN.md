# MiniMaze — design and build plan

A wooden tilt labyrinth, the one with two knobs on the side that every
grandparent's cupboard had. Tilt the board, roll a steel marble along the
grooves, past the holes, into the goal. On a phone or tablet the device *is*
the board: tilt it in your hands. Everywhere else, a drag, the arrow keys or a
gamepad stick tilts it for you.

It is also the hub's **three.js trial**: the smallest real game that exercises
what a 3D game here needs (scene, light, shadow, reflections, instancing,
input that is genuinely 3D, the arcade iframe) so we learn whether "a
renderer, not an engine" is enough before anything bigger leans on it.

Part of the [games hub](../CLAUDE.md); its rules apply throughout. When this
file and the code disagree, this file is corrected first.

The name is **MiniMaze**, the owner's, and the slug `minimaze`. The slug is
the URL and the storage prefix, so once pushed it stays: a rename costs
players their progress (hub §6).

---

## 1. Decisions taken before a line was written

| Question | Decision | Why |
|---|---|---|
| Renderer | three.js **r186 (0.186.1)**, WebGL renderer | Genuinely 3D: the tilt *is* the game. The trial is the point. WebGPU renderer not used — WebGL reaches every tablet in the house. |
| Physics | Hand-written, 2D in board space | One ball on one plane. Hub §1 bans general-purpose engines; nothing here needs one. See §4. |
| Loading three | **Local vendored copy only, no CDN** | Ships unminified (r186 has no `.min` builds); ~420 KB gzipped, precached once by the SW. A CDN buys nothing a precache doesn't, and a module import cannot carry SRI without an import map. Nothing to block, nothing third-party in the request log. |
| Bare `'three'` in add-ons | `tools/vendor-three.mjs` copies the files and rewrites `from 'three'` to a relative path | Hub §2 forbids import maps. This is a packaging step: it copies and rewrites one specifier, compiles nothing, and the copied files are committed. |
| Language | Plain ES modules over HTTP | Hub §2. |
| Board art | Procedural three geometry for M1 | Boards, walls and holes are extrusions and boxes, generated from the level grid, so a model file would fight the level data. Blender (hub §9) for the frame, knobs and anything organic, if and when that earns it. |
| Fail state | **None.** Fall in a hole, the marble pops back out at the start | Vinjar is five. The challenge is the maze, not a lives counter. |
| Timer | A quiet stopwatch, best time remembered per level | A record to beat, not a countdown (§1: no artificial timers). Never shown as a failure. |
| Sound | Sonic Pi cues, rolling loop modulated live | Hub §9. Rolling must track speed continuously, so it is one looped file with `playbackRate`/gain driven per frame, which is the sanctioned exception's own example. |
| Multiplayer | No | Hub §8 default. |

---

## 2. Layout and ownership

One file, one owner (hub §12). **sim** is written first and alone because
everything else is a view of it, and it never imports three.

```
minimaze/
  index.html               DOM shell: screens, HUD, corner, crash bar           [ui]
  manifest.webmanifest     "MiniMaze — <tagline>"                               [assets]
  sw.js                    minimaze-<VERSION>, cache-first, opt-in update       [assets]
  css/style.css            every screen; touch-guard block at the top          [ui]
  vendor/three/            three.module.js, three.core.js, chosen add-ons     [vendor, generated]
  js/
    config.js              every tuning number                                  [sim]
    main.js                boot, fixed-step loop, wiring                        [glue]
    levels.js              the mazes, as ASCII grids (§5)                       [sim]
    store.js               finished mazes and best times                        [ui]
    sim/gadgets.js         kickers, gears, switches, gates (§5)                 [sim]
    render/gadgets-mesh.js what the gadgets look like                           [render]
    sim/board.js           parse a level grid -> walls, holes, start, goal      [sim]
    sim/marble.js          integrate, collide, fall, goal (§4)                 [sim]
    input/tilt.js          device orientation -> tilt, calibration, permission  [input]
    input/pointer.js       drag-to-tilt, keyboard, gamepad -> the same tilt     [input]
    render/scene.js        renderer, camera fit, lights, shadows, env map      [render]
    render/board-mesh.js   board with holes, instanced walls, goal              [render]
    render/marble-mesh.js  the steel ball, its roll, its fall                    [render]
    ui.js                  title, level select, pause, level-clear, volume      [ui]
    audio.js               cue loader, the rolling loop, two buses              [assets]
    update.js              SW registration + UPDATE READY (self-contained)     [assets]
    screen.js              fullscreen + orientation lock (self-contained)       [assets]
    touch-guard.js         classic script, from lobbots                         [assets]
  audio/*.m4a              rendered cues                                         [assets]
  icons/                   192, 512, 512-maskable, 180                           [assets]
  tools/
    vendor-three.mjs       copy + rewrite the three files we ship               [vendor]
    make-icons.py          Pillow, procedural: a marble over a hole             [assets]
    check-levels.mjs       every maze finishable, no kicker traps (§5)         [sim]
    audio/*.rb             the cue compositions                                 [assets]
  README.md, DESIGN.md
```

The `input/` split exists because tilt is the riskiest part of the game
(§3) and should be replaceable without touching anything else. Both modules
write the same thing: a target tilt `{x, y}` in radians, clamped to
`config.MAX_TILT`.

---

## 3. Input: one tilt, four sources

Everything reduces to a **target tilt** about the board's two axes. The board
eases toward it (a real board has mass; instant tilt feels digital), and the
physics reads the *eased* tilt, so what you see is what rolls the ball.

1. **Device tilt** (phone, tablet). `deviceorientation` beta/gamma, rotated by
   `screen.orientation.angle` so "away from you" is up in every orientation.
   - **Calibration, not absolute level.** Nobody holds a tablet flat. The tilt
     at the moment a level starts is "level", and a *Hold it how you like*
     line says so. A recalibrate button lives in the pause menu.
   - **iOS asks permission** through `DeviceOrientationEvent.requestPermission()`,
     which must be called from a tap. The title screen's way in is that tap.
     Refused or unavailable: fall through to drag, silently, and say once
     which control is active.
   - **The arcade iframe** already allows `accelerometer` and `gyroscope`
     (hub §5). Untested in practice: no game has used them yet. Verify on a
     real iPad inside the arcade before M1 is called done.
   - **Auto-rotate is the enemy.** Tilting a phone far enough rotates the
     page. `screen.js` pairs fullscreen with an orientation lock where the
     browser allows it (fishtank's pattern); where it doesn't (iPhone), keep
     `MAX_TILT` small enough (~15°) that normal play stays below the rotate
     threshold, and test that number on a real phone.
2. **Drag** (any pointer). Press anywhere on the board and drag: the offset
   from the press point is the tilt, like pushing the board's edge. Release
   eases back to level. Pointer Events only (hub §10).
3. **Keyboard.** Arrows / WASD, eased in and out so a tap is a nudge.
4. **Gamepad.** Left stick, with a deadzone. Polled, not evented.

Device tilt and drag can coexist: a drag overrides tilt while it is held.

---

## 4. Physics

All in **board space**, 2D, fixed step at 120 Hz with an accumulator, `dt`
clamped and substeps capped (hub §10). Units are grid cells; the marble's
radius is ~0.3 cells.

- **Acceleration** = `g · sin(tilt)` per axis, scaled by `5/7` for a rolling
  solid sphere (that factor is why a real marble feels heavier than a
  sliding puck — cheap to include, noticeable to leave out).
- **Rolling friction** as a small constant deceleration, plus a speed cap.
- **Walls** are axis-aligned boxes from the grid. Collide circle-vs-box,
  push out along the contact normal, reflect the normal velocity with
  restitution ~0.35. The impact speed is reported as an event for the clack
  sound and a tiny camera nudge. At the speed cap and 120 Hz the marble
  moves well under its own radius per step, so no tunnelling and no swept
  tests needed; assert that in `config.js` with a comment.
- **Holes** are circles. Once the marble's centre is inside a hole's radius
  it *falls*: physics stops, the render plays a short drop into the hole
  (sink, shrink into darkness), and it respawns at the start (or the last
  checkpoint, if a level has one). Near the rim, a gentle pull toward the
  hole centre sells the lip of a real hole.
- **Goal** is a cup like a hole that you are meant to fall into: same
  test, different ending.
- The ball's **visual spin** is derived from velocity (`angle = distance / r`
  about the axis perpendicular to motion), applied as a quaternion so it
  never gimbals. Pure render; the sim does not know it spins.

The sim exposes `step(state, tilt, dt)` and returns events
(`wall`, `fall`, `goal`), and never touches the DOM or three.

---

## 5. Levels

Hand-authored ASCII in `levels.js`, one string per level, any size:

```
#############
#S....#.....#
#.###.#.#O#.#
#...#...#...#
###.#####.#.#
#O..........#
#.#######.#G#
#############
```

`#` wall, `.` floor, `S` start, `G` goal, `O` hole. The board mesh is
generated from this grid at load, so a new level is one string and nothing
else. `levels.js`'s header is the authoritative glyph list.

**Gadgets** (owner's ask, 2026-10-07: "gears and switches that can launch
you in directions"), in `sim/gadgets.js` and drawn by
`render/gadgets-mesh.js`:

| Glyph | Gadget | Does |
|---|---|---|
| `> < ^ v` | kicker | throws the marble that way, through the air over the next two cells (holes there do not catch it), landing in the third with half its speed |
| `@ &` | gear | brass turntable, clockwise / anticlockwise, with an open hub that is a real hole; grips hard, so you ride it round rather than roll across; needs the 3×3 round it clear |
| `*` | switch | flips every gate and reverses every gear |
| `= _` | gate | shut / open at the start; never shuts on the marble, waits until it is clear |

**Every gadget must be needed** (owner, 2026-10-07, on the first gadget
levels: "a lot of the levels allow you to just go around the gears and
whatnot — you don't really have to engage with the mechanics"). That
first version made kickers mere speed boosts and gears floor ornaments, and
nothing a player could not do by tilting. So each kind now does one thing
tilt cannot: a kicker crosses a **trench** of holes, a gear is the only
floor across a **walled band** and cannot be cut through the middle, a
switch opens the **gate** in front of the goal. The checker enforces it
(below).

A fall resets every gadget to how the level began, so a fall is always a
clean retry.

**The checker.** `node tools/check-levels.mjs` searches every level as a
grid puzzle (state = cell × gates flipped) and fails it unless:

- it can be finished;
- no reachable spot is a trap, i.e. one from which the goal cannot be
  reached without deliberately falling (a kicker in a one-wide corridor is a
  one-way door);
- every kind of gadget on the board is needed: with kickers or switches
  turned to plain floor, or gears turned to holes, it must be impossible.

Run it after every level edit. Its model of a throw (fly two, land in the
third, slide on) matches `HOP_TIME` in config.js, so change them together.
It treats a gear's ring as floor and does not model the spin, so a pass
means the route exists; riding the gear is the player's job.

**Eighteen mazes**, ordered to teach: two with no holes at all (a
five-year-old's first minute decides whether he keeps going), then holes,
then each gadget on its own (kickers 7, gears 10, switches 11) before they
are combined. All open from the start, picked from a grid of numbered
blocks, ticked once finished; no locked doors. Progress and best times are
kept by maze name in `minimaze.progress.v1` (`js/store.js`), so reordering
levels never moves a tick.

---

## 6. Look

The classic wooden labyrinth: warm light wood board, darker walls, black
holes with a hint of depth, a polished steel marble, all seen from slightly
above and in front so the tilt reads.

- **Lighting**: one directional key light with soft shadows (the marble's
  shadow is how you judge where it is), plus a hemisphere fill.
- **Reflections**: `RoomEnvironment` through `PMREMGenerator` gives the
  marble something to reflect, generated once, with no image files.
- **Walls**: one `InstancedMesh` for every wall cell, one draw call.
- **Board**: an extruded `Shape` with the holes cut as paths, so the holes
  are real holes and the marble can visibly drop through.
- **Camera**: perspective, fitted to the board each resize so the whole maze
  is always in view in portrait and landscape. A level wider than tall turns
  the board 90° in portrait rather than shrinking it.
- **Resolution**: `devicePixelRatio` capped at 2 (hub §10); drop to 1.5 and
  cheaper shadows if a frame-time watchdog says the tablet is struggling.
- **No per-frame allocation** in the loop: reuse vectors and quaternions.

Menus are DOM over the live board, which stays visible and gently tilting
behind them. They are made of the toy (owner, 2026-10-07: "wooden + brass
like the maze"): a light plank in a walnut frame with a brass rim, brass
screws and engraved letters. The wood is the *same* canvas the board is
textured with, handed to CSS as a data URL, so the cards are cut from the
board's own plank. Brass is what you press; walnut is the quieter choice
beside it, the same size.

Flat brass needs a part-metal material (`brassFlat`): at full metalness a
flat plate mirrors one direction of the room and goes olive. Only curved
brass, like the goal ring, keeps the true mirror.

---

## 7. The hub floor (owed before promotion, built in M2)

All of hub §2's six menu duties and the touch layers, in their exact form:
the corner (menu, sound, fullscreen; **on every screen**, because the HUD is
a level name and a stopwatch and leaves the corner free); MUSIC and EFFECTS
sliders with `minimaze.vol.music.v1` / `minimaze.vol.sfx.v1`; a title screen
with the way in and "back to arcade" under it via `arcade/exit.js`; aligned
groups; the landscape-phone grid (maxgear's shape); the touch guard and CSS
from lobbots, with the board `touch-action: none`. Solo game, so the menu
pauses.

Plus hub §3 (SW, slug-filtered cleanup, `GET_VERSION`, opt-in update) and §4
(manifest, icons from `make-icons.py`).

Storage: `minimaze.progress.v1` holds finished levels and best times.

---

## 8. Milestones

- **M1 — does it feel right.** One level, the full physics, tilt + drag +
  keys, the scene as §6 describes. No menus beyond a tap-to-start. Played on
  a real phone and a real iPad, inside the arcade and out. The question M1
  answers is whether the marble feels like a marble; nothing else matters
  until it does.
- **M1½ — done 2026-10-07, at the owner's ask after a first look.** Gadgets,
  eighteen mazes, the maze picker, a pause card, the wooden menus.
- **M2 — a game.** The whole hub floor (§7), sounds, icons, manifest, SW.
- **M3 — if it earns it.** Blender frame and knobs, checkpoints, moving
  pieces (a swinging gate, a rotating disc), a Norwegian-language toggle for
  the few words on screen.

**And the trial's verdict**, written into this file after M2: what three.js
cost us, what we built that Babylon would have given us, and whether the
next 3D game here should use it.

---

## 9. Open questions for the owner

- Whether the stopwatch is shown during play or only on the level-clear
  card. Leaning: only on the card, so play stays calm for the youngest.
