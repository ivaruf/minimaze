# MiniMaze

A wooden tilt maze. Tilt the board, roll the steel marble past the holes and
into the brass cup. On a phone or tablet you tilt the device itself; anywhere
else, drag the board, use the arrow keys / WASD, or a gamepad stick.

Part of the [games hub](../CLAUDE.md), and its first three.js game. The plan,
the physics and the reasons are in [DESIGN.md](DESIGN.md).

## Status

**M1**: three mazes, the full physics, all four inputs, the scene. No menus
beyond a start card and a clear card, no sound, no service worker, no
manifest yet; those are M2 (DESIGN.md §8). Not deployed.

## Running

```sh
python3 -m http.server   # from this directory, then open http://localhost:8000/
```

ES modules need HTTP; `file://` is not supported. Device tilt needs a real
phone or tablet, and on iOS a secure origin (https) as well, so on the
local network it falls back to drag; test tilt from the deployed site.

## three.js

Vendored, not fetched: `vendor/three/` is three **0.186.1**, copied by
`tools/vendor-three.mjs`, which rewrites the add-ons' bare `'three'` import
to a relative path because the hub does not use import maps. To change
version or add an add-on: edit `package.json` / the script's `ADDONS`, then
`npm install && npm run vendor`, and commit the result.

## Keys

Arrows / WASD tilt. `C` makes the current device hold "level" again.
