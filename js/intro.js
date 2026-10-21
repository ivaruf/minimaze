/*
 * intro.js — the three-second sting that plays when the game opens.
 *
 * The toy, played once. The board settles onto the walnut seen from straight
 * above — a maple plank in a brass rim, two walnut walls folding it into an
 * S — and the steel marble sets off from the top left, rolls the whole S
 * along its groove, and drops into the brass cup in the bottom right with a
 * glint off the rim. Then the curtain fades onto the real board, the marble
 * already home at the start of the first maze, under the title card. It is
 * the icon (tools/make-icons.py: the board from above, marble top left, cup
 * bottom right) set rolling, in the same colours — the cabinet art's frame,
 * maple, brass and steel, and css/style.css's --walnut behind it all. The
 * walls are straightened from the icon's so the route is one the marble
 * could actually take.
 *
 * Nothing about it is text, so it has nothing for js/i18n.js to translate.
 *
 * WHAT IT MAY NOT DO
 *   - Cost anyone a run (hub §1). It only ever plays at page load, over the
 *     title card, and any tap or key skips straight to the hand-off.
 *   - Let the skipping press through. A key is swallowed in the capture
 *     phase on window — capture on window runs before anything bubbling, and
 *     this script runs async from the top of <body>, long before the module
 *     graph, so it is registered ahead of js/main.js's and
 *     js/input/pointer.js's keydowns — because the press that skips must not
 *     also be the title's Escape (which is the way out to the arcade) or an
 *     arrow that tilts the board. A tap lands on the curtain itself, which
 *     covers every button.
 *   - Delay the game. It is a curtain over the page, not a gate in front of
 *     it: three.js, the board and the title card boot underneath while it
 *     plays, which is mostly time the player would otherwise spend watching
 *     an empty walnut screen.
 *   - Play for someone who has asked for less motion. prefers-reduced-motion
 *     means the script does nothing at all.
 *
 * A classic script, self-contained, importing nothing, for the reason
 * touch-guard.js, update.js and screen.js stand apart: if anything in the
 * module graph fails, the curtain must still lift. Every frame runs inside a
 * try, a hard timeout removes the curtain whatever happens, and a failure of
 * this file leaves the game exactly as it was without it. Its <script> tag
 * carries data-handled so that, missing, it is not reported by the crash bar.
 *
 * Canvas 2D, devicePixelRatio capped at 2, the route sampled once, the
 * marble's shading one gradient in its own unit space, and no allocation in
 * the frame loop (hub §10).
 */
(function () {
  "use strict";

  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) {
    /* No matchMedia: play it. */
  }

  // The palette: the icon's (the cabinet art's) and css/style.css's walnut.
  // Copied rather than imported because this file imports nothing.
  var WALNUT = "#1d140d";
  var FRAME = "#674127";
  var FRAME_HI = "#8a5a36";
  var MAPLE = "#d8b27a";
  var GROOVE = "rgba(150, 100, 50, 0.22)";
  var GRAIN = "rgba(120, 75, 35, 0.10)";
  var BRASS = "#bc954d";
  var BRASS_HI = "#f3cf7a";
  var CUP = "#39291d";

  // The timeline, in milliseconds. BOARD: the board settles in. ROLL_AT to
  // ROLL_AT + ROLL_MS: the marble rolls the S. DROP: it falls into the cup,
  // and the rim glints. LAND starts the hand-off, which takes LAND_MS (or
  // SKIP_MS when the player skipped).
  var BOARD = 420;
  var ROLL_AT = 300;
  var ROLL_MS = 1650;
  var DROP_MS = 320;
  var LAND = 2350;
  var LAND_MS = 600;
  var SKIP_MS = 350;

  // ---- the board, in the icon's 192-unit drawing -------------------------
  //
  // The board is x/y 15.5..176.5 in a brass rim. Two walls, 13 wide: one
  // from the left edge across most of the board at y 68, one from the right
  // edge at y 120, so the route is a true S. The marble (r 14) starts at
  // the icon's top left and ends in the icon's cup.
  var WALLS = [15.5, 68, 140, 68, 52, 120, 176.5, 120];
  var MR = 14;
  var CUP_X = 146;
  var CUP_Y = 150;
  // The route's corners. Each is rounded with a quadratic curve, then the
  // whole route is sampled once into ROUTE with its running length in LEN.
  var CORNERS = [43, 42, 161, 42, 161, 94, 31, 94, 31, 150, CUP_X, CUP_Y];
  var ROUND = 18;
  var CURVE_STEPS = 8;
  var NPTS = 2 + (CORNERS.length / 2 - 2) * (CURVE_STEPS + 1);
  var ROUTE = new Float32Array(NPTS * 2);
  var LEN = new Float32Array(NPTS);
  (function sample() {
    var n = 0;
    function put(x, y) {
      ROUTE[n * 2] = x;
      ROUTE[n * 2 + 1] = y;
      n++;
    }
    put(CORNERS[0], CORNERS[1]);
    for (var c = 1; c < CORNERS.length / 2 - 1; c++) {
      var px = CORNERS[(c - 1) * 2];
      var py = CORNERS[(c - 1) * 2 + 1];
      var x = CORNERS[c * 2];
      var y = CORNERS[c * 2 + 1];
      var nx = CORNERS[(c + 1) * 2];
      var ny = CORNERS[(c + 1) * 2 + 1];
      var d0 = Math.hypot(x - px, y - py);
      var d1 = Math.hypot(nx - x, ny - y);
      // Where the curve leaves the incoming leg and joins the outgoing one.
      var ax = x + ((px - x) / d0) * ROUND;
      var ay = y + ((py - y) / d0) * ROUND;
      var bx = x + ((nx - x) / d1) * ROUND;
      var by = y + ((ny - y) / d1) * ROUND;
      for (var i = 0; i <= CURVE_STEPS; i++) {
        var u = i / CURVE_STEPS;
        var v = 1 - u;
        put(v * v * ax + 2 * v * u * x + u * u * bx, v * v * ay + 2 * v * u * y + u * u * by);
      }
    }
    put(CORNERS[CORNERS.length - 2], CORNERS[CORNERS.length - 1]);
    LEN[0] = 0;
    for (var k = 1; k < NPTS; k++) {
      LEN[k] = LEN[k - 1] + Math.hypot(ROUTE[k * 2] - ROUTE[k * 2 - 2], ROUTE[k * 2 + 1] - ROUTE[k * 2 - 1]);
    }
  })();
  var TOTAL = LEN[NPTS - 1];

  var canvas = document.createElement("canvas");
  canvas.id = "intro";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  // The steel ball, lit from the top left as in the icon: one gradient in
  // the ball's unit space, placed by the transform.
  var steel = ctx.createRadialGradient(-0.4, -0.5, 0, -0.4, -0.5, 1.5);
  steel.addColorStop(0, "#ffffff");
  steel.addColorStop(0.4 / 1.5 + 0.1, "#d7e1e7");
  steel.addColorStop(1, "#52616b");

  var W = 0;
  var H = 0;
  var dpr = 1;
  var unit = 1; // CSS px per icon unit

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // The board's 192 units fill most of the short side, centred.
    unit = (Math.min(W, H) * 0.82) / 192;
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
  function easeOut(x) {
    return 1 - Math.pow(1 - x, 3);
  }
  function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  // The roll: a gentle push off, a steady run, and a little faster at the
  // end where the board would be tipped towards the cup.
  function rollEase(x) {
    return x < 0.2 ? 2.5 * x * x : 0.1 + (x - 0.2) * 1.125;
  }

  // Where the marble is along the route, written into pos[0..1].
  var pos = new Float32Array(2);
  function at(dist) {
    if (dist <= 0) {
      pos[0] = ROUTE[0];
      pos[1] = ROUTE[1];
      return;
    }
    for (var k = 1; k < NPTS; k++) {
      if (LEN[k] >= dist) {
        var f = (dist - LEN[k - 1]) / (LEN[k] - LEN[k - 1] || 1);
        pos[0] = ROUTE[k * 2 - 2] + (ROUTE[k * 2] - ROUTE[k * 2 - 2]) * f;
        pos[1] = ROUTE[k * 2 - 1] + (ROUTE[k * 2 + 1] - ROUTE[k * 2 - 1]) * f;
        return;
      }
    }
    pos[0] = ROUTE[NPTS * 2 - 2];
    pos[1] = ROUTE[NPTS * 2 - 1];
  }

  var t0 = 0;
  var landAt = LAND;
  var landMs = LAND_MS;
  var done = false;
  var raf = 0;

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", size);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  function skip() {
    var now = performance.now() - t0;
    if (now >= landAt) return;
    landAt = now;
    landMs = SKIP_MS;
  }

  function onKey(e) {
    // Skip, and let the press go no further: see the header.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) skip();
  }

  // A rounded rectangle path, in icon units.
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBoard(t) {
    // The rim and the plank.
    ctx.fillStyle = BRASS;
    rr(13, 13, 166, 166, 18);
    ctx.fill();
    ctx.fillStyle = MAPLE;
    rr(15.5, 15.5, 161, 161, 15.5);
    ctx.fill();

    // A little grain, so it reads as wood and not as a beige square.
    ctx.strokeStyle = GRAIN;
    ctx.lineWidth = 1.2;
    for (var g = 0; g < 9; g++) {
      var gy = 24 + g * 18;
      ctx.beginPath();
      ctx.moveTo(16, gy);
      ctx.bezierCurveTo(70, gy - 5 + (g % 3) * 3, 120, gy + 6 - (g % 2) * 5, 176, gy - 2);
      ctx.stroke();
    }

    // The groove the marble runs in: the whole route, worn faintly darker.
    ctx.strokeStyle = GROOVE;
    ctx.lineWidth = MR * 2.1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ROUTE[0], ROUTE[1]);
    for (var k = 1; k < NPTS; k++) ctx.lineTo(ROUTE[k * 2], ROUTE[k * 2 + 1]);
    ctx.stroke();

    // The walls: walnut, with the light catching their top edge.
    ctx.lineCap = "butt";
    for (var w = 0; w < WALLS.length; w += 4) {
      ctx.strokeStyle = FRAME;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(WALLS[w], WALLS[w + 1]);
      ctx.lineTo(WALLS[w + 2], WALLS[w + 3]);
      ctx.stroke();
      ctx.strokeStyle = FRAME_HI;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WALLS[w], WALLS[w + 1] - 5.5);
      ctx.lineTo(WALLS[w + 2], WALLS[w + 3] - 5.5);
      ctx.stroke();
    }

    // The cup: a brass rim round a dark hole.
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.arc(CUP_X, CUP_Y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CUP;
    ctx.beginPath();
    ctx.arc(CUP_X, CUP_Y, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  // The marble at (x, y) in icon units, radius r, at opacity a, on a board
  // drawn with scale k (device px per icon unit) from origin (bx, by).
  function drawMarble(x, y, r, a, k, bx, by) {
    // A soft shadow down and to the right, as the key light throws it.
    ctx.globalAlpha = 0.25 * a;
    ctx.fillStyle = "#2a1a0c";
    ctx.beginPath();
    ctx.arc(x + r * 0.22, y + r * 0.3, r, 0, Math.PI * 2);
    ctx.fill();
    // The ball itself in its own unit space, so the one gradient fits it.
    ctx.globalAlpha = a;
    ctx.fillStyle = steel;
    ctx.setTransform(k * r, 0, 0, k * r, bx + x * k, by + y * k);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.setTransform(k, 0, 0, k, bx, by);
  }

  function frame(now) {
    if (done) return;
    try {
      if (!t0) t0 = now;
      var t = now - t0;
      var land = clamp01((t - landAt) / landMs);
      if (land >= 1) {
        finish();
        return;
      }
      var fade = 1 - easeInOut(land);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      ctx.fillStyle = WALNUT;
      ctx.fillRect(0, 0, W, H);

      // The board settles: down from a touch larger, as if set on the
      // table; and swells a touch as the curtain lifts off it, handing over
      // to the real board underneath.
      var b = easeOut(clamp01(t / BOARD));
      var scale = (1.06 - 0.06 * b) * (1 + 0.05 * easeInOut(land));
      ctx.globalAlpha = fade * b;
      var k = unit * scale * dpr;
      // Scale about the board's centre (icon unit 96, 96).
      var bx = (W / 2 - 96 * unit * scale) * dpr;
      var by = (H / 2 - 96 * unit * scale) * dpr;
      ctx.setTransform(k, 0, 0, k, bx, by);
      drawBoard(t);

      // The marble: rolls the route, then drops into the cup — smaller and
      // darker as it sinks below the rim — and the rim glints.
      var roll = clamp01((t - ROLL_AT) / ROLL_MS);
      at(rollEase(roll) * TOTAL);
      var drop = clamp01((t - ROLL_AT - ROLL_MS) / DROP_MS);
      if (drop < 1) {
        var r = MR * (1 - 0.45 * drop * drop);
        drawMarble(pos[0], pos[1], r, fade * b * (1 - drop * drop), k, bx, by);
      }
      var glint = (t - ROLL_AT - ROLL_MS - DROP_MS * 0.6) / 450;
      if (glint > 0 && glint < 1) {
        ctx.globalAlpha = fade * (1 - glint);
        ctx.strokeStyle = BRASS_HI;
        ctx.lineWidth = 3 * (1 - glint) + 0.5;
        ctx.beginPath();
        ctx.arc(CUP_X, CUP_Y, 17 + 16 * easeOut(glint), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } catch (e) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    size();
    window.addEventListener("resize", size);
    window.addEventListener("keydown", onKey, true);
    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      skip();
    });
    document.body.appendChild(canvas);
    raf = requestAnimationFrame(frame);
    // Whatever happens to the frame loop, the curtain does not outstay this.
    setTimeout(finish, 6000);
  }

  // Loaded from the top of <body>, so the body exists even though the rest
  // of the page may not have been parsed yet.
  start();
})();
