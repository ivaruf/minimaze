// MiniMaze service worker: a versioned precache, so the board rolls on a
// plane, in a tunnel, and through a deploy that lands mid-maze.
//
// UPDATE MODEL ("opt-in", hub CLAUDE.md §3). Bump VERSION on every committed
// batch that deploys, and keep it HERE, as a literal in this file: the browser
// decides a worker has changed by comparing this script's bytes, so a version
// kept in some imported file leaves sw.js identical between releases and an
// installed copy never hears of one. The page registers with
// { updateViaCache: 'none' } and calls reg.update() at launch and whenever it
// comes back into view. The new worker precaches the whole list below and then
// WAITS: js/update.js shows the UPDATE READY button on the title card, and only
// that tap posts SKIP_WAITING. There is deliberately no skipWaiting() in
// install — taking over unasked would swap the modules under a marble that is
// halfway to the cup ("a deploy must never destroy a run in progress", hub §1).
//
// GET_VERSION lets the page print the build that is actually serving it, which
// during a botched release is the one question you cannot answer by looking.
//
// The cache name is prefixed with the slug and the cleanup filter below only
// ever deletes keys that carry that prefix: every game in this hub shares one
// origin and therefore one CacheStorage, so a sloppy filter evicts a
// neighbour's offline copy.
//
// All paths are RELATIVE: the game is served from /minimaze/ and is also
// framed by the arcade from a sibling directory.

const VERSION = 'v0.4.2'; // the language row lives in the menu panel only; the title card keeps the ways in and the way out
const CACHE = `minimaze-${VERSION}`;

// Every shipped file. install blocks until all of it is cached, so this list is
// the whole game: a file missing from it works online and silently vanishes
// offline, and a file listed but not deployed fails the install outright and
// leaves the player on the previous version. Keep it in step with the layout in
// DESIGN.md §2. three.js is vendored (README), about 1.5 MB of it, and listed
// like everything else: without it there is no board to roll on.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/update.js',
  './js/touch-guard.js',
  './js/screen.js',
  './js/main.js',
  './js/config.js',
  './js/levels.js',
  './js/store.js',
  './js/ui.js',
  './js/i18n.js',
  './js/sim/board.js',
  './js/sim/marble.js',
  './js/sim/gadgets.js',
  './js/input/tilt.js',
  './js/input/pointer.js',
  './js/render/scene.js',
  './js/render/board-mesh.js',
  './js/render/gadgets-mesh.js',
  './js/render/marble-mesh.js',
  './vendor/three/three.module.js',
  './vendor/three/three.core.js',
  './vendor/three/addons/environments/RoomEnvironment.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-512.png',
];

// `cache: 'reload'` on everything the install stores. Without it the precache
// reads through the browser's HTTP cache, which may still hold yesterday's copy
// of a file, so a new version could be filed with some of the old files in it —
// on 2026-10-11 dam_break ran a new screens.js against a stale sound.js and the
// menu never wired up. The arcade learned this first (arcade/sw.js, `fresh`).
const fresh = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  // No skipWaiting() here: after precaching, the new worker stays WAITING until
  // the player accepts the update from the title card.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map(fresh))));
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_VERSION' && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // 'minimaze-' only. Every other game keeps its caches on this same
        // origin and none of them are ours to delete.
        keys.filter((k) => k.startsWith('minimaze-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Cache-first out of the current versioned precache, so every module in one
  // session comes from ONE deploy: the sim, the renderer and three.js can never
  // be from different builds. New versions arrive as a whole new cache through
  // install/activate above, never file by file.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => (request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
