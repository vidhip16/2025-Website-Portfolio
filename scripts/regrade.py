"""Regrade Vidhi's original project images into gallery "prints" (blueprint §6.6).

Crop to 4:5, blend 70% of a plum→lilac→plaster colourise with 30% of the
original colour, add grain at .07, export 1200 px wide to public/work/originals/.

Usage: python3 scripts/regrade.py <originals_dir>
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/work/originals"
# source file -> project slug. HandleScout's (wrong) image and the Video
# Extender image with the baked-in typo are not used.
MAP = {
    "typeracer.jpg": "type-racer",
    "washroom.jpg": "washroom-finder",
    "portfolio.jpg": "image-generator",
    "picconvert.jpg": "picture-converter",
}
W, H = 1200, 1500


def crop45(im: Image.Image) -> Image.Image:
    w, h = im.size
    if w / h > 4 / 5:
        nw = round(h * 4 / 5)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w * 5 / 4)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def main() -> None:
    src_dir = Path(sys.argv[1]).expanduser()
    OUT.mkdir(parents=True, exist_ok=True)
    grain = Image.open(ROOT / "public/grain.png").convert("RGBA")
    for name, slug in MAP.items():
        im = crop45(Image.open(src_dir / name).convert("RGB")).resize((W, H), Image.LANCZOS)
        tinted = ImageOps.colorize(
            ImageOps.grayscale(im), black="#23162E", mid="#B7A3F0", white="#F6F1FA"
        )
        out = Image.blend(im, tinted, 0.70).convert("RGBA")
        tile = Image.new("RGBA", (W, H))
        for y in range(0, H, grain.height):
            for x in range(0, W, grain.width):
                tile.paste(grain, (x, y))
        a = tile.getchannel("A").point(lambda v: round(v * 0.07))
        tile.putalpha(a)
        out = Image.alpha_composite(out, tile).convert("RGB")
        dest = OUT / f"{slug}.jpg"
        out.save(dest, quality=82, optimize=True, progressive=True)
        print(dest.relative_to(ROOT), dest.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
