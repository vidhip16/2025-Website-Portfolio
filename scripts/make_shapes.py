"""Dot-stage shape masks (blueprint §5.1, Revision R1 type).

Writes public/dots/{braces,db-net,terminal,envelope}.png (512x512, white on
transparent; the sampler reads alpha) and public/dots/shapes.json with two eye
anchors per shape (normalised 0..1), so every shape keeps Ping's pupils.
Braces are Instrument Serif "{ }"; the terminal prompt is Departure Mono ">_".

Usage: python3 scripts/make_shapes.py
"""
import io
import json
from pathlib import Path

import cairosvg
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/dots"
S = 512


def glyph_svg(font_path: Path, text: str, gap: float, box: float = 0.78, stroke: float = 0) -> str:
    """Centre `text` (glyph outlines) in a 512 box, scaled to `box` of the side."""
    f = TTFont(font_path)
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    names = [cmap[ord(c)] for c in text]
    x, parts, bounds = 0.0, [], []
    for i, n in enumerate(names):
        bp = BoundsPen(gs)
        gs[n].draw(bp)
        if bp.bounds:
            b = bp.bounds
            bounds.append((b[0] + x, b[1], b[2] + x, b[3]))
        parts.append((n, x))
        x += gs[n].width + (gap * f["head"].unitsPerEm if i < len(names) - 1 else 0)
    x0 = min(b[0] for b in bounds); y0 = min(b[1] for b in bounds)
    x1 = max(b[2] for b in bounds); y1 = max(b[3] for b in bounds)
    k = box * S / max(x1 - x0, y1 - y0)
    ox = (S - (x1 - x0) * k) / 2 - x0 * k
    oy = (S + (y1 - y0) * k) / 2 + y0 * k
    d = ""
    for n, dx in parts:
        pen = SVGPathPen(gs)
        gs[n].draw(TransformPen(pen, (k, 0, 0, -k, ox + dx * k, oy)))
        d += pen.getCommands()
    sw = f' stroke="#fff" stroke-width="{stroke}" stroke-linejoin="round"' if stroke else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}"><path fill="#fff"{sw} d="{d}"/></svg>'


def db_net_svg() -> str:
    w = 26  # stroke width
    cyl = (
        f'<ellipse cx="150" cy="150" rx="92" ry="34" fill="#fff"/>'
        f'<path d="M58 150 V330 A92 34 0 0 0 242 330 V150" fill="none" stroke="#fff" stroke-width="{w}"/>'
        f'<path d="M58 210 A92 34 0 0 0 242 210 M58 270 A92 34 0 0 0 242 270" fill="none" stroke="#fff" stroke-width="{w * 0.8}"/>'
    )
    nodes = [(380, 120), (452, 230), (390, 340), (300, 420), (452, 420)]
    edges = [(0, 1), (1, 2), (0, 2), (2, 3), (2, 4), (1, 4)]
    lines = "".join(f'<line x1="{nodes[a][0]}" y1="{nodes[a][1]}" x2="{nodes[b][0]}" y2="{nodes[b][1]}" stroke="#fff" stroke-width="14" stroke-linecap="round"/>' for a, b in edges)
    link = '<line x1="242" y1="240" x2="390" y2="340" stroke="#fff" stroke-width="14" stroke-linecap="round"/>'
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="30" fill="#fff"/>' for x, y in nodes)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">{cyl}{link}{lines}{dots}</svg>'


def envelope_svg() -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
        '<rect x="56" y="126" width="400" height="270" rx="46" fill="none" stroke="#fff" stroke-width="30"/>'
        '<path d="M86 160 L256 288 L426 160" fill="none" stroke="#fff" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/>'
        '<path d="M86 370 L200 262 M426 370 L312 262" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>'
        "</svg>"
    )


def departure_ttf() -> Path:
    tmp = ROOT / "test-results/DepartureMono.ttf"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    f = TTFont(ROOT / "public/fonts/DepartureMono.woff2")
    f.flavor = None
    f.save(tmp)
    return tmp


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    shapes = {
        "braces": (glyph_svg(ROOT / "assets/fonts/InstrumentSerif-Regular.ttf", "{}", 0.55, 0.80, stroke=10), [[0.42, 0.44], [0.58, 0.44]]),
        "db-net": (db_net_svg(), [[0.235, 0.30], [0.345, 0.30]]),
        "terminal": (glyph_svg(departure_ttf(), ">_", 0.1, 0.70), [[0.40, 0.30], [0.60, 0.30]]),
        "envelope": (envelope_svg(), [[0.42, 0.62], [0.58, 0.62]]),
    }
    # A pre-sized sampling copy (600 px tall, alpha intact) so the dot stage
    # never downloads the 1.78 MB body PNG and the fallback draw is 1:1.
    body = Image.open(ROOT / "public/ping/ping-body.png").convert("RGBA")
    h = 600
    body.resize((round(body.width * h / body.height), h), Image.LANCZOS).save(OUT / "ping-body-600.png", optimize=True)
    manifest = {
        "ping-hero": {"src": "/dots/ping-body-600.png", "eyes": "gaze.json"},
        "ping-seat": {"src": "/dots/ping-body-600.png", "eyes": "gaze.json", "scale": 0.6},
    }
    total = 0
    for name, (svg, eyes) in shapes.items():
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=S, output_height=S)
        im = Image.open(io.BytesIO(png)).convert("RGBA")
        a = im.getchannel("A")
        mask = Image.new("LA", (S, S), (255, 0))
        mask.putalpha(a)
        p = OUT / f"{name}.png"
        mask.save(p, optimize=True)
        total += p.stat().st_size
        manifest[name] = {"src": f"/dots/{name}.png", "eyes": eyes}
    (OUT / "shapes.json").write_text(json.dumps({"order": ["ping-hero", "ping-seat", "braces", "db-net", "terminal", "envelope"], "shapes": manifest}, indent=2))
    print("masks", total, "bytes")


if __name__ == "__main__":
    main()
