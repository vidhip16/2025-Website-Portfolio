"""T0 fallback halftones (blueprint §5.6): one static dot-grid image per shape.

Writes public/dots/halftone-{0..5}.webp (lilac→bubblegum dots for paper) and
halftone-{0..5}-night.webp (lilac→glow dots for the projection room), 640x640,
from the same sources the WebGL sampler uses (public/dots/shapes.json).
Dot radius follows local coverage (and brightness for Ping), so the T0 frame
reads as the same shape the live cloud draws.

Usage: python3 scripts/render_halftones.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE, STEP = 640, 10
PAPER = [(0xB7, 0xA3, 0xF0), (0xFF, 0x86, 0xB5)]
NIGHT = [(0xB7, 0xA3, 0xF0), (0xFF, 0xF0, 0xFA)]


def source(entry) -> tuple[np.ndarray, np.ndarray]:
    """(coverage 0..1, brightness 0..1) at SIZE, subject fitted in a 86% box."""
    im = Image.open(ROOT / "public" / entry["src"].lstrip("/")).convert("RGBA")
    scale = entry.get("scale", 1.0) * 0.86 * SIZE / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    arr = np.asarray(canvas).astype(np.float32) / 255
    return arr[..., 3], arr[..., :3].mean(axis=2)


def render(cov, lum, ramp, ping: bool) -> Image.Image:
    out = Image.new("RGBA", (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for y in range(STEP // 2, SIZE, STEP):
        for x in range(STEP // 2, SIZE, STEP):
            c = cov[y - STEP // 2:y + STEP // 2, x - STEP // 2:x + STEP // 2].mean()
            if c < 0.12:
                continue
            v = lum[y, x] if ping else 1.0
            r = STEP * 0.5 * c * (0.35 + 0.65 * v)
            t = min(1.0, max(0.0, (v - 0.55) * 2.2)) if ping else (x + y) / (2 * SIZE) * 0.6
            col = tuple(round(a + (b - a) * t) for a, b in zip(*ramp))
            d.ellipse([2 * (x - r), 2 * (y - r), 2 * (x + r), 2 * (y + r)], fill=col + (255,))
    return out.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    m = json.loads((ROOT / "public/dots/shapes.json").read_text())
    for i, name in enumerate(m["order"]):
        entry = m["shapes"][name]
        cov, lum = source(entry)
        ping = name.startswith("ping")
        for suffix, ramp in (("", PAPER), ("-night", NIGHT)):
            p = ROOT / f"public/dots/halftone-{i}{suffix}.webp"
            render(cov, lum, ramp, ping).save(p, "WEBP", quality=82, method=6)
            print(p.name, p.stat().st_size)


if __name__ == "__main__":
    main()
