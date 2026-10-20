"""Export the raster head kit from app/icon.svg (blueprint §1.5).

  app/apple-icon.png          180 px, opaque, full-bleed paper (iOS rounds it)
  public/icon-192.png         192 px, rounded tile (manifest "any")
  public/icon-512.png         512 px, rounded tile (manifest "any")
  public/icon-maskable-512.png 512 px, full-bleed paper, head inside the 80% safe zone
  app/favicon.ico             32 px (plus 16 px)

Usage: python3 scripts/make_icons.py   (needs Homebrew cairo, see DECISIONS 5)
"""
import io
import re
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = (ROOT / "app/icon.svg").read_text()
# Light scheme only for rasters (media queries don't apply at export time).
LIGHT = re.sub(r"@media \(prefers-color-scheme:dark\)\{.*?\}\}", "", SVG)


def full_bleed(scale: float) -> str:
    """Square paper background, head scaled about the centre."""
    body = re.search(r'(<path class="hd".*)</svg>', LIGHT, re.S).group(1)
    style = re.search(r"<style>.*?</style>", LIGHT, re.S).group(0)
    t = 16 * (1 - scale)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' + style
        + '<rect class="bg" width="32" height="32"/>'
        + f'<g transform="translate({t:.3f} {t:.3f}) scale({scale})">{body}</g></svg>'
    )


def render(svg: str, size: int) -> Image.Image:
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")


def main() -> None:
    render(full_bleed(0.82), 180).convert("RGB").save(ROOT / "app/apple-icon.png", optimize=True)
    render(LIGHT, 192).save(ROOT / "public/icon-192.png", optimize=True)
    render(LIGHT, 512).save(ROOT / "public/icon-512.png", optimize=True)
    render(full_bleed(0.62), 512).convert("RGB").save(ROOT / "public/icon-maskable-512.png", optimize=True)
    ico = render(LIGHT, 32)
    ico.save(ROOT / "app/favicon.ico", sizes=[(16, 16), (32, 32)])
    for p in ["app/apple-icon.png", "public/icon-192.png", "public/icon-512.png", "public/icon-maskable-512.png", "app/favicon.ico"]:
        print(p, (ROOT / p).stat().st_size)


if __name__ == "__main__":
    main()
