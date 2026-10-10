#!/usr/bin/env python3
"""Generate the MiniMaze icon set.

    python3 tools/make-icons.py

Writes icons/icon-192.png, icon-512.png, icon-180.png and
icon-maskable-512.png. Requires Pillow (stdlib otherwise); no network, no
fonts, no external assets. The script is the source of truth, not the PNGs
(hub CLAUDE.md §4): change the motif here and re-run, never touch the images.

THE MOTIF: the toy seen from straight above. A walnut frame, a maple board
inside it rimmed in brass, two walnut walls folding the board into an S, the
brass cup in the bottom right and the steel marble in the top left, at the
start of the route. It is the same drawing as the arcade's cabinet art
(arcade/assets/games/minimaze.svg, on its 192 grid), so the icon a player
taps on their home screen is the face they saw on the machine.

WHAT MAKES IT LEGIBLE AT 24 px: three values. The pale maple board is the
mass; the dark walnut walls cut it into a shape you can read as "a path";
the marble is the one near-white highlight, top left, where the eye starts.
The cup's brass rim, the board's brass rim and the marble's shading are
512-px enrichment and are allowed to vanish small.

Every icon is opaque to its corners. iOS paints a transparent apple-touch
icon's empty pixels black, and a maskable icon must fill its frame, so the
walnut runs full bleed and only the board inside it has rounded corners.
The maskable copy draws the same picture into its 80% safe zone.

Rendered 4x and downsampled with LANCZOS. The palette is the game's own:
the frame, board, wall and brass tones are the cabinet art's, and the
manifest's background is css/style.css's --walnut, the colour behind the
board while the game boots.
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

# ---- palette (the cabinet art's, and css/style.css's --walnut) -----------
FRAME = (103, 65, 39)       # #674127 the walnut frame and the walls
MAPLE = (216, 178, 122)     # #d8b27a the board
BRASS = (188, 149, 77)      # #bc954d the board's rim and the cup's
CUP = (57, 41, 29)          # #39291d the hole inside the cup
STEEL_HI = (255, 255, 255)
STEEL_MID = (215, 225, 231)  # #d7e1e7
STEEL_LO = (82, 97, 107)    # #52616b

SS = 4  # supersample factor


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def marble(img, cx, cy, r):
    """A steel ball lit from the top left: the cabinet art's radial gradient
    (white, then #d7e1e7 at 40%, then #52616b), centred 30% across and 25%
    down the ball, drawn as shrinking discs."""
    d = ImageDraw.Draw(img)
    hx, hy = cx - r + 0.6 * r, cy - r + 0.5 * r  # 30% / 25% of the diameter
    steps = max(8, int(r))
    for i in range(steps, 0, -1):
        t = i / steps  # 1 at the rim, 0 at the highlight
        col = lerp(STEEL_HI, STEEL_MID, t / 0.4) if t < 0.4 else lerp(STEEL_MID, STEEL_LO, (t - 0.4) / 0.6)
        # Each disc is a step from the highlight towards the true outline, so
        # the outermost one is exactly the ball.
        ox, oy = hx + (cx - hx) * t, hy + (cy - hy) * t
        rr = r * t
        d.ellipse([ox - rr, oy - rr, ox + rr, oy + rr], fill=col)


def motif(size, inset):
    """The whole picture at `size` px, its 192-unit drawing scaled into the
    square that leaves `inset` (a fraction of the side) on every edge."""
    S = size * SS
    # The walnut frame runs full bleed, in the maskable copy too, so the
    # safe-zone crop never finds an edge.
    img = Image.new("RGB", (S, S), FRAME)
    d = ImageDraw.Draw(img)

    span = S * (1 - 2 * inset)
    k = span / 192.0
    o = S * inset

    def p(v):
        return o + v * k

    # Board: x/y 13, 166 square, rx 18, brass stroke 5.
    d.rounded_rectangle([p(13), p(13), p(179), p(179)], radius=18 * k, fill=BRASS)
    d.rounded_rectangle([p(15.5), p(15.5), p(176.5), p(176.5)], radius=15.5 * k, fill=MAPLE)

    # Walls: M26 68h112V42 and M166 120H54v30, 13 wide with round joins.
    w = 13 * k
    for pts in ([(26, 68), (138, 68), (138, 42)], [(166, 120), (54, 120), (54, 150)]):
        xy = [(p(x), p(y)) for x, y in pts]
        # Butt caps and round joins, as the SVG has them.
        d.line(xy, fill=FRAME, width=round(w), joint="curve")

    # Cup: r 14 at (146, 148), brass rim 6.
    cx, cy = p(146), p(148)
    r_out, r_in = (14 + 3) * k, (14 - 3) * k
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=BRASS)
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=CUP)

    # Marble: r 14 at (43, 43).
    marble(img, p(43), p(43), 14 * k)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    # The plain icons give the board almost the whole frame; the cabinet art's
    # own 13-unit walnut border is the margin.
    for size in (192, 512, 180):
        motif(size, 0.0).save(os.path.join(OUT, f"icon-{size}.png"), optimize=True)
    # Maskable: everything that matters inside the central 80% circle a
    # launcher may crop to, so the board shrinks and the walnut bleeds round it.
    motif(512, 0.12).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    print("wrote", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
