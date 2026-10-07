#!/usr/bin/env node
/*
 * vendor-three.mjs — copy the three.js files MiniMaze ships into vendor/three.
 *
 * A packaging step, not a build (hub CLAUDE.md §2): it copies files and
 * rewrites one import specifier, and compiles nothing. Its output is
 * committed, so the game never needs node to run and what devtools shows is
 * three.js's own source, line for line.
 *
 * Why the rewrite exists: three's add-ons import the bare name 'three',
 * which a browser only resolves through an import map, and the hub forbids
 * import maps. So every `from 'three'` in a copied add-on becomes a relative
 * path to the copied three.module.js. The core files import each other
 * relatively already and are copied untouched.
 *
 * Why no CDN in front (DESIGN.md §1): r186 ships no minified build, a module
 * import cannot carry SRI without an import map, and the service worker
 * precaches the local copy anyway.
 *
 * Usage:  npm install && npm run vendor
 *    or:  node tools/vendor-three.mjs <path to an unpacked three package>
 *
 * To add an add-on, list it in ADDONS and rerun. To upgrade three, change the
 * pinned version in package.json, rerun, and read the release notes first:
 * three breaks things most months.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] || join(root, 'node_modules/three'));
const out = join(root, 'vendor/three');

const CORE = ['build/three.module.js', 'build/three.core.js', 'LICENSE'];

// Add-ons, relative to examples/jsm/. Each lands at vendor/three/addons/<same path>.
const ADDONS = ['environments/RoomEnvironment.js'];

const pkg = JSON.parse(await readFile(join(src, 'package.json'), 'utf8'));
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'addons'), { recursive: true });

for (const file of CORE) {
  const name = file.split('/').pop();
  await writeFile(join(out, name), await readFile(join(src, file)));
}

const moduleFile = join(out, 'three.module.js');
for (const file of ADDONS) {
  const dest = join(out, 'addons', file);
  await mkdir(dirname(dest), { recursive: true });
  let to = relative(dirname(dest), moduleFile);
  if (!to.startsWith('.')) to = './' + to;
  const text = await readFile(join(src, 'examples/jsm', file), 'utf8');
  const rewritten = text.replace(/(from\s*)(['"])three\2/g, `$1$2${to}$2`);
  if (/from\s*['"]three['"]/.test(rewritten)) throw new Error(`unrewritten import left in ${file}`);
  await writeFile(dest, rewritten);
}

await writeFile(
  join(out, 'VERSION'),
  `three ${pkg.version}\nCopied by tools/vendor-three.mjs; do not edit by hand.\n`,
);
console.log(`vendored three ${pkg.version}: ${CORE.length} core files, ${ADDONS.length} add-ons`);
