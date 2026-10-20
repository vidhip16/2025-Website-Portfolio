"""Write public/grain.png: a 256 px tileable monochrome noise tile (seed 7).

The tile is ink-coloured noise in the alpha channel, so CSS applies it by
opacity only (no mix-blend-mode): .07 on paper, .13 on solid tiles.
Usage: python3 scripts/make_grain.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 256
rng = np.random.default_rng(7)
noise = rng.normal(0.0, 1.0, (SIZE, SIZE))
# Light 3x3 box blur with wrap-around keeps the tile seamless and the grain fine.
blur = sum(np.roll(np.roll(noise, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
grain = noise * 0.65 + blur * 0.35
grain = (grain - grain.min()) / (grain.max() - grain.min())
# Sparse grain: only the brightest ~18% of samples get ink, in 3 alpha levels,
# so the tile stays small (palette PNG, mostly-transparent runs).
level = np.digitize(grain, np.quantile(grain, [0.82, 0.92, 0.97]))
img = Image.fromarray(level.astype(np.uint8), "P")
img.putpalette([0x23, 0x16, 0x2E] * 4)
out = Path(__file__).resolve().parent.parent / "public/grain.png"
img.save(out, optimize=True, transparency=bytes([0, 110, 180, 255]), bits=2)
print(out.name, out.stat().st_size, "bytes")
