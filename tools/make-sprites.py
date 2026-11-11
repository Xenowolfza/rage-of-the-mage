#!/usr/bin/env python3
"""Generate the Rage of the Mage pixel-art sprite sheets (no third-party deps).

Each sheet is 128x32: four 32x32 frames laid out horizontally. Every character
faces right; the game mirrors the image for units facing left.

Run:  python3 tools/make-sprites.py
Out:  assets/sprites/<unit>.png  and  assets/sprites/_preview.png
"""

import os
import struct
import zlib

W = H = 32
FRAMES = 4
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sprites")

# ---------------------------------------------------------------- palette
C = {
    "clear": (0, 0, 0, 0),
    "skin": (232, 185, 138, 255),
    "skin_d": (201, 150, 104, 255),
    "steel": (185, 194, 204, 255),
    "steel_d": (111, 123, 136, 255),
    "steel_l": (230, 237, 243, 255),
    "leather": (107, 74, 47, 255),
    "leather_d": (74, 51, 32, 255),
    "red": (168, 50, 50, 255),
    "red_d": (122, 34, 34, 255),
    "blue": (59, 95, 168, 255),
    "blue_d": (42, 68, 125, 255),
    "blue_l": (111, 146, 216, 255),
    "green": (63, 122, 74, 255),
    "green_d": (42, 84, 51, 255),
    "bone": (232, 226, 207, 255),
    "bone_d": (179, 171, 147, 255),
    "zombie": (127, 156, 94, 255),
    "zombie_d": (92, 116, 66, 255),
    "purple": (91, 45, 110, 255),
    "purple_d": (61, 29, 74, 255),
    "glow": (199, 139, 255, 255),
    "gold": (216, 165, 58, 255),
    "gold_d": (150, 110, 32, 255),
    "cyan": (127, 240, 224, 255),
    "white": (244, 246, 250, 255),
    "dark": (26, 22, 20, 255),
    "rust": (154, 139, 106, 255),
    "yellow": (226, 208, 92, 255),
}


class Sheet:
    def __init__(self):
        self.px = [[C["clear"] for _ in range(W)] for _ in range(H)]

    def set(self, x, y, color):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[y][x] = C[color] if isinstance(color, str) else color

    def rect(self, x0, y0, x1, y1, color):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, color)

    def rows(self):
        return [[b for px in row for b in px] for row in self.px]


def shade(col, factor):
    """Multiply an rgba colour by a factor, keeping alpha."""
    r, g, b, a = C[col]
    return (
        max(0, min(255, int(r * factor))),
        max(0, min(255, int(g * factor))),
        max(0, min(255, int(b * factor))),
        a,
    )


# ---------------------------------------------------------------- characters
def framing(f):
    """Return (bob, stride, arm) offsets for a walk cycle frame."""
    return [
        (0, 1, 0),
        (-1, 0, 1),
        (0, -1, 0),
        (-1, 0, -1),
    ][f]


def legs(s, left_x, right_x, top, bottom, color, boot_color, stride, bob):
    lx = left_x + stride
    rx = right_x - stride
    s.rect(lx, top + bob, lx + 3, bottom - 2 + bob, color)
    s.rect(rx, top + bob, rx + 3, bottom - 2 + bob, color)
    s.rect(lx - (1 if stride > 0 else 0), bottom - 2 + bob, lx + 3, bottom + bob, boot_color)
    s.rect(rx, bottom - 2 + bob, rx + 3 + (1 if stride > 0 else 0), bottom + bob, boot_color)


def warrior(s, f):
    bob, stride, arm = framing(f)
    # cape
    s.rect(8, 13 + bob, 12, 26 + bob, shade("red_d", 0.9))
    s.rect(9, 25 + bob, 12, 27 + bob, "red_d")
    # legs + boots
    legs(s, 12, 18, 23, 31, "leather_d", "steel_d", stride, bob)
    # tabard + chainmail torso
    s.rect(11, 12 + bob, 21, 24 + bob, "steel")
    s.rect(11, 12 + bob, 21, 13 + bob, "steel_l")
    s.rect(14, 12 + bob, 18, 25 + bob, "red")
    s.rect(15, 12 + bob, 17, 25 + bob, "red_d")
    s.rect(11, 22 + bob, 21, 24 + bob, "leather_d")
    s.set(16, 22 + bob, "gold")
    # shield arm
    s.rect(7, 14 + bob, 9, 22 + bob, "steel_d")
    s.set(8, 22 + bob, "skin")
    s.rect(4, 14 + bob + arm, 9, 24 + bob + arm, "leather_d")
    s.rect(5, 15 + bob + arm, 8, 23 + bob + arm, "steel")
    s.rect(6, 16 + bob + arm, 7, 22 + bob + arm, "steel_d")
    s.set(7, 19 + bob + arm, "gold")
    # sword arm
    s.rect(21, 14 + bob, 23, 21 + bob, "steel_d")
    s.set(22, 21 + bob, "skin")
    # helmet + head
    s.rect(12, 6 + bob, 20, 12 + bob, "skin")
    s.rect(12, 10 + bob, 20, 12 + bob, "skin_d")
    s.rect(11, 4 + bob, 21, 8 + bob, "steel")
    s.rect(11, 7 + bob, 21, 8 + bob, "steel_l")
    s.rect(15, 8 + bob, 17, 11 + bob, "steel_d")
    s.rect(18, 8 + bob, 19, 9 + bob, "dark")
    s.set(13, 8 + bob, "steel_d")
    # sword raised toward the foe
    s.rect(23, 9 + bob, 25, 21 + bob, "steel_l")
    s.rect(25, 9 + bob, 25, 21 + bob, "white")
    s.rect(21, 20 + bob, 25, 21 + bob, "gold")
    s.rect(23, 22 + bob, 24, 23 + bob, "leather_d")


def mage(s, f):
    bob, stride, arm = framing(f)
    # robe (trapezoid) with gold trim
    for i, y in enumerate(range(12, 31)):
        half = 5 + i // 5
        s.rect(16 - half, y + bob, 15 + half, y + bob, "blue")
    for i, y in enumerate(range(12, 31)):
        half = 5 + i // 5
        s.set(16 - half, y + bob, "blue_d")
        s.set(15 + half, y + bob, "blue_d")
    s.rect(9, 29 + bob, 23, 30 + bob, "blue_d")
    s.rect(11, 20 + bob, 21, 21 + bob, "gold_d")
    s.set(16, 23 + bob, "gold")
    s.set(15, 24 + bob, "gold")
    s.set(17, 24 + bob, "gold")
    s.set(16, 25 + bob, "gold")
    # sleeves + hands
    s.rect(9, 14 + bob, 11, 20 + bob, "blue_d")
    s.rect(21, 14 + bob, 23, 19 + bob, "blue_d")
    s.set(10, 21 + bob + arm, "skin")
    s.set(22, 20 + bob, "skin")
    # staff
    s.rect(25, 8 + bob, 26, 30 + bob, "leather_d")
    s.set(26, 12 + bob, "leather")
    s.set(26, 18 + bob, "leather")
    s.set(26, 24 + bob, "leather")
    s.rect(24, 4 + bob, 27, 7 + bob, "glow")
    s.rect(25, 4 + bob, 26, 6 + bob, "white")
    s.set(23, 6 + bob, "glow")
    s.set(28, 5 + bob, "glow")
    # head + pointed hat
    s.rect(13, 7 + bob, 19, 12 + bob, "skin")
    s.rect(14, 11 + bob, 18, 12 + bob, "skin_d")
    s.set(15, 9 + bob, "dark")
    s.set(18, 9 + bob, "dark")
    s.rect(13, 12 + bob, 18, 14 + bob, "white")   # beard
    s.rect(9, 6 + bob, 23, 7 + bob, "blue_d")     # brim
    s.rect(12, 4 + bob, 20, 5 + bob, "blue")
    s.rect(14, 2 + bob, 18, 3 + bob, "blue")
    s.rect(15, 0 + bob, 17, 1 + bob, "blue_l")
    s.set(16, 0 + bob, "gold")


def ranger(s, f):
    bob, stride, arm = framing(f)
    # cloak behind
    s.rect(8, 13 + bob, 11, 27 + bob, "green_d")
    # legs
    legs(s, 12, 18, 23, 31, "leather", "leather_d", stride, bob)
    # tunic
    s.rect(11, 12 + bob, 21, 23 + bob, "green")
    s.rect(11, 12 + bob, 21, 13 + bob, "green_d")
    s.rect(11, 21 + bob, 21, 23 + bob, "leather_d")
    s.set(16, 21 + bob, "gold")
    # quiver of arrows
    s.rect(8, 12 + bob, 10, 21 + bob, "leather")
    for x in (8, 9, 10):
        s.set(x, 10 + bob, "gold")
        s.set(x, 11 + bob, "rust")
    # hood + face
    s.rect(12, 5 + bob, 20, 11 + bob, "green")
    s.rect(13, 6 + bob, 19, 10 + bob, "skin")
    s.rect(13, 6 + bob, 19, 7 + bob, "green_d")
    s.rect(14, 9 + bob, 18, 11 + bob, "leather_d")  # scarf
    s.set(15, 8 + bob, "dark")
    s.set(18, 8 + bob, "dark")
    # arms
    s.rect(20, 14 + bob, 23, 19 + bob, "green_d")
    s.rect(9, 14 + bob, 11, 19 + bob, "green_d")
    s.set(22, 20 + bob, "skin")
    s.set(10, 20 + bob + arm, "skin")
    # bow
    s.rect(25, 9 + bob, 25, 25 + bob, "leather")
    s.rect(26, 8 + bob, 27, 9 + bob, "leather")
    s.rect(26, 25 + bob, 27, 26 + bob, "leather")
    s.rect(27, 11 + bob, 27, 23 + bob, "bone_d")
    s.set(26, 10 + bob, "gold")


def skeleton(s, f):
    bob, stride, arm = framing(f)
    legs(s, 13, 17, 25, 31, "bone_d", "bone_d", stride, bob)
    # pelvis + spine + ribs
    s.rect(12, 22 + bob, 20, 24 + bob, "bone")
    s.rect(15, 14 + bob, 17, 22 + bob, "bone_d")
    for y in (14, 16, 18, 20):
        s.rect(11, y + bob, 21, y + 1 + bob, "bone")
    s.rect(12, 14 + bob, 12, 21 + bob, "bone_d")
    s.rect(20, 14 + bob, 20, 21 + bob, "bone_d")
    # arms
    s.rect(8, 14 + bob, 10, 21 + bob, "bone")
    s.rect(22, 14 + bob, 24, 21 + bob, "bone")
    s.set(9, 22 + bob, "bone_d")
    s.set(23, 22 + bob, "bone_d")
    # skull
    s.rect(12, 4 + bob, 20, 11 + bob, "bone")
    s.rect(13, 12 + bob, 19, 13 + bob, "bone_d")
    s.rect(13, 6 + bob, 15, 9 + bob, "dark")
    s.rect(17, 6 + bob, 19, 9 + bob, "dark")
    s.set(16, 9 + bob, "bone_d")
    for x in (14, 16, 18):
        s.set(x, 11 + bob, "dark")
    # rusted blade
    s.rect(24, 11 + bob, 25, 21 + bob, "rust")
    s.set(26, 12 + bob, "bone_d")
    s.rect(22, 20 + bob, 25, 20 + bob, "leather_d")


def zombie(s, f):
    bob, stride, arm = framing(f)
    legs(s, 12, 18, 24, 31, "leather_d", "leather_d", stride, bob)
    # ragged tunic
    s.rect(11, 13 + bob, 21, 23 + bob, "leather")
    for x, y in ((12, 14), (18, 16), (13, 20), (20, 21), (15, 22)):
        s.set(x, y + bob, "zombie")
    s.rect(11, 22 + bob, 21, 23 + bob, "leather_d")
    # outstretched arms
    s.rect(21, 15 + bob, 28, 17 + bob, "zombie")
    s.rect(27, 14 + bob, 29, 17 + bob, "zombie_d")
    s.rect(8, 16 + bob + arm, 11, 18 + bob + arm, "zombie")
    # hunched head
    s.rect(13, 5 + bob, 21, 12 + bob, "zombie")
    s.rect(14, 12 + bob, 20, 13 + bob, "zombie_d")
    s.rect(13, 4 + bob, 18, 5 + bob, "dark")      # hair
    s.set(15, 8 + bob, "yellow")
    s.set(18, 8 + bob, "yellow")
    s.set(16, 11 + bob, "dark")
    s.set(17, 11 + bob, "dark")
    s.set(19, 12 + bob, "bone")                    # tooth


def wight(s, f):
    bob, stride, arm = framing(f)
    bob -= 1  # hovers a little
    # tattered cape
    s.rect(8, 13 + bob, 12, 28 + bob, "dark")
    s.set(9, 28 + bob, "clear")
    s.set(11, 28 + bob, "clear")
    legs(s, 12, 18, 24, 31, shade("steel_d", 0.8), "dark", stride, bob)
    # armour
    s.rect(11, 12 + bob, 21, 23 + bob, "steel_d")
    s.rect(11, 12 + bob, 21, 13 + bob, "steel")
    s.rect(14, 14 + bob, 18, 22 + bob, "dark")
    s.set(16, 16 + bob, "cyan")
    s.set(15, 18 + bob, "cyan")
    s.set(17, 18 + bob, "cyan")
    s.rect(9, 12 + bob, 10, 13 + bob, "steel")     # pauldrons
    s.rect(22, 12 + bob, 23, 13 + bob, "steel")
    s.rect(11, 22 + bob, 21, 23 + bob, "gold_d")
    # arms + blade
    s.rect(8, 14 + bob, 10, 22 + bob, "steel_d")
    s.rect(22, 14 + bob, 24, 20 + bob, "steel_d")
    s.rect(24, 9 + bob, 25, 20 + bob, "steel_l")
    s.set(25, 10 + bob, "cyan")
    s.rect(22, 19 + bob, 25, 20 + bob, "gold_d")
    # head
    s.rect(12, 5 + bob, 20, 11 + bob, "bone_d")
    s.rect(13, 6 + bob, 19, 10 + bob, "cyan")
    s.rect(13, 6 + bob, 19, 7 + bob, "steel_d")
    s.set(14, 8 + bob, "white")
    s.set(18, 8 + bob, "white")
    s.rect(14, 11 + bob, 18, 12 + bob, "dark")


def necromancer(s, f):
    bob, stride, arm = framing(f)
    # robe
    for i, y in enumerate(range(11, 31)):
        half = 5 + i // 6
        s.rect(16 - half, y + bob, 15 + half, y + bob, "purple")
        s.set(16 - half, y + bob, "purple_d")
        s.set(15 + half, y + bob, "purple_d")
    for x in (10, 13, 16, 19, 22):
        s.set(x, 30 + bob, "clear")
    s.rect(11, 19 + bob, 21, 20 + bob, "gold_d")
    s.set(16, 22 + bob, "glow")
    # hood shadow + glowing eyes
    s.rect(11, 3 + bob, 21, 6 + bob, "purple_d")
    s.rect(9, 7 + bob, 23, 8 + bob, "purple_d")
    s.rect(12, 7 + bob, 20, 12 + bob, "dark")
    s.set(14, 9 + bob, "glow")
    s.set(18, 9 + bob, "glow")
    s.set(14, 10 + bob, "glow")
    s.set(18, 10 + bob, "glow")
    # sleeves + hands
    s.rect(8, 13 + bob, 11, 20 + bob, "purple_d")
    s.rect(21, 13 + bob, 24, 19 + bob, "purple_d")
    s.set(9, 21 + bob + arm, "bone")
    s.set(23, 20 + bob, "bone")
    # staff with a skull
    s.rect(26, 6 + bob, 27, 30 + bob, "dark")
    s.rect(25, 4 + bob, 28, 6 + bob, "bone")
    s.set(26, 5 + bob, "dark")
    s.set(28, 5 + bob, "dark")
    s.rect(25, 2 + bob, 28, 3 + bob, "glow")
    s.set(24, 4 + bob, "glow")
    s.set(29, 4 + bob, "glow")


def ghoul(s, f):
    bob, stride, arm = framing(f)
    # hunched: everything leans right, head low and forward
    skin, skin_d = "zombie", shade("zombie_d", 0.85)
    # legs (long, bent)
    lx = 13 + stride
    rx = 18 - stride
    s.rect(lx, 24 + bob, lx + 2, 31 + bob, "leather_d")
    s.rect(rx, 24 + bob, rx + 2, 31 + bob, "leather_d")
    s.rect(lx - 1, 30 + bob, lx + 2, 31 + bob, skin)
    s.rect(rx, 30 + bob, rx + 2, 31 + bob, skin)
    # ragged loincloth / torn body
    s.rect(12, 15 + bob, 20, 23 + bob, skin)
    s.rect(13, 19 + bob, 19, 22 + bob, "leather_d")
    for x, y in ((14, 16), (18, 18), (13, 21), (19, 20)):
        s.set(x, y + bob, skin_d)
    # ribs showing through
    for y in (17, 19):
        s.set(15, y + bob, "bone_d")
        s.set(17, y + bob, "bone_d")
    # arms reaching forward with claws
    s.rect(20, 14 + bob, 28, 16 + bob, skin)
    s.rect(27, 13 + bob, 29, 16 + bob, skin)
    for x in (28, 29, 30):
        s.set(x, 13 + bob, "bone")
        s.set(x, 16 + bob, "bone")
    s.rect(19, 17 + bob + arm, 26, 19 + bob + arm, skin)
    for x in (26, 27):
        s.set(x, 18 + bob + arm, "bone")
    # head, low and forward
    s.rect(16, 6 + bob, 23, 12 + bob, skin)
    s.rect(17, 11 + bob, 22, 13 + bob, skin_d)
    s.rect(16, 4 + bob, 21, 6 + bob, "leather_d")   # stringy hair
    s.set(19, 8 + bob, "red")                       # hungry eyes
    s.set(22, 8 + bob, "red")
    s.set(20, 12 + bob, "dark")                     # mouth
    s.set(21, 12 + bob, "bone")


def wraith(s, f):
    bob, stride, arm = framing(f)
    bob -= [0, -1, -2, -1][f]  # floats on a slow wave
    body = "dark"
    rim = shade("blue_d", 1.15)
    # hooded head
    s.rect(11, 2 + bob, 21, 9 + bob, rim)
    s.rect(12, 3 + bob, 20, 8 + bob, body)
    s.rect(13, 4 + bob, 19, 8 + bob, shade("dark", 1.4))
    s.set(14, 6 + bob, "cyan")
    s.set(18, 6 + bob, "cyan")
    s.set(14, 7 + bob, "cyan")
    s.set(18, 7 + bob, "cyan")
    # shoulders + tattered mantle
    s.rect(9, 10 + bob, 23, 15 + bob, rim)
    s.rect(10, 11 + bob, 22, 14 + bob, body)
    # sleeves reaching
    s.rect(22, 12 + bob, 27, 14 + bob, rim)
    s.rect(23, 13 + bob, 26, 13 + bob, body)
    s.set(27, 13 + bob, "cyan")
    s.rect(5, 12 + bob, 9, 14 + bob, rim)
    # body tapering to a wisp trail (no legs)
    for i, y in enumerate(range(16, 31)):
        half = max(1, 6 - i // 3)
        s.rect(16 - half, y + bob, 15 + half, y + bob, body)
        s.set(16 - half, y + bob, rim)
        s.set(15 + half, y + bob, rim)
    for x in (12, 15, 18, 20):
        s.set(x, 30 + bob, "clear")
    for x in (13, 19):
        s.set(x, 29 + bob, "clear")


def witch(s, f):
    bob, stride, arm = framing(f)
    robe = "green"
    robe_d = "green_d"
    # robe: bent, narrow, hem tattered
    for i, y in enumerate(range(12, 31)):
        half = 4 + i // 6
        s.rect(16 - half, y + bob, 15 + half, y + bob, robe)
        s.set(16 - half, y + bob, robe_d)
        s.set(15 + half, y + bob, robe_d)
    for x in (11, 14, 17, 20):
        s.set(x, 30 + bob, "clear")
    s.rect(11, 20 + bob, 21, 21 + bob, "leather_d")
    s.set(16, 23 + bob, "yellow")   # charm
    s.set(13, 25 + bob, "bone")
    # hunched shoulders + hood
    s.rect(10, 11 + bob, 22, 12 + bob, robe_d)
    s.rect(12, 4 + bob, 22, 10 + bob, robe)
    s.rect(12, 5 + bob, 20, 9 + bob, shade("dark", 1.3))
    s.set(14, 7 + bob, "glow")      # green glow eyes
    s.set(18, 7 + bob, "glow")
    s.set(20, 8 + bob, "skin_d")    # long nose poking out of the shadow
    # gnarled staff with a knotted head
    s.rect(25, 7 + bob, 26, 30 + bob, "leather_d")
    s.rect(24, 3 + bob, 27, 6 + bob, "leather")
    s.set(23, 4 + bob, "leather_d")
    s.set(27, 2 + bob, "glow")
    s.set(28, 4 + bob, "bone")
    s.set(27, 7 + bob, "gold")
    # claw hand mid-staff
    s.rect(23, 13 + bob, 25, 19 + bob, robe_d)
    s.set(24, 20 + bob, "skin_d")
    # other hand clutching a bundle of roots
    s.rect(9, 14 + bob + arm, 12, 20 + bob + arm, robe_d)
    s.rect(8, 18 + bob + arm, 11, 21 + bob + arm, "leather")


def karand(s, f):
    bob, stride, arm = framing(f)
    bronze = "gold_d"
    bronze_d = shade("gold_d", 0.72)
    # heavy legs + boots
    legs(s, 11, 18, 23, 31, bronze_d, "leather_d", stride, bob)
    # bronze cuirass over rotting frame
    s.rect(10, 12 + bob, 22, 23 + bob, bronze)
    s.rect(10, 12 + bob, 22, 13 + bob, "gold")
    s.rect(12, 15 + bob, 20, 21 + bob, bronze_d)
    s.set(16, 17 + bob, "zombie")
    s.set(15, 18 + bob, "zombie")
    s.set(17, 19 + bob, "zombie_d")
    s.rect(10, 22 + bob, 22, 23 + bob, "leather_d")
    s.set(16, 22 + bob, "rust")
    # pauldrons + helm with crest
    s.rect(8, 11 + bob, 10, 14 + bob, "gold")
    s.rect(22, 11 + bob, 24, 14 + bob, "gold")
    s.rect(12, 3 + bob, 20, 10 + bob, bronze)
    s.rect(13, 5 + bob, 19, 10 + bob, "zombie")
    s.rect(12, 3 + bob, 20, 4 + bob, "rust")       # crest
    s.rect(15, 2 + bob, 17, 3 + bob, "rust")
    s.set(15, 7 + bob, "dark")
    s.set(18, 7 + bob, "dark")
    s.set(16, 10 + bob, "dark")
    s.set(17, 10 + bob, "dark")
    # shield arm
    s.rect(5, 14 + bob + arm, 10, 25 + bob + arm, bronze)
    s.rect(6, 15 + bob + arm, 9, 24 + bob + arm, bronze_d)
    s.set(7, 19 + bob + arm, "rust")
    # mace arm
    s.rect(23, 14 + bob, 25, 21 + bob, bronze_d)
    s.rect(25, 8 + bob, 27, 15 + bob, "leather_d")  # haft
    s.rect(24, 5 + bob, 28, 8 + bob, "steel_d")     # head
    s.set(25, 5 + bob, "steel_l")
    s.set(28, 7 + bob, "steel_l")


# ---------------------------------------------------------------- png writer
def write_png(path, width, height, rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


def sheet_rows(draw):
    rows = [[] for _ in range(H)]
    for f in range(FRAMES):
        s = Sheet()
        draw(s, f)
        for y in range(H):
            rows[y].extend(s.rows()[y])
    return rows


def scale_rows(rows, factor):
    out = []
    for row in rows:
        big = []
        for x in range(0, len(row), 4):
            pixel = row[x:x + 4]
            big.extend(pixel * factor)
        for _ in range(factor):
            out.append(big)
    return out


UNITS = {
    "warrior": warrior,
    "mage": mage,
    "ranger": ranger,
    "skeleton": skeleton,
    "zombie": zombie,
    "ghoul": ghoul,
    "wraith": wraith,
    "wight": wight,
    "karand": karand,
    "witch": witch,
    "necromancer": necromancer,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    preview = []
    blank = [0] * (W * FRAMES * 4)
    for name, draw in UNITS.items():
        rows = sheet_rows(draw)
        write_png(os.path.join(OUT, f"{name}.png"), W * FRAMES, H, rows)
        if name in ("warrior", "mage", "ghoul", "wraith", "witch", "karand"):
            preview.extend(rows)
            preview.extend([list(blank), list(blank)])
    write_png(os.path.join(OUT, "_preview.png"), W * FRAMES, len(preview), preview)
    print(f"wrote {len(UNITS)} sheets to {OUT}")


if __name__ == "__main__":
    main()
