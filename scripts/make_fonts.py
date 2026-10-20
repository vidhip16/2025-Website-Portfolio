"""Build the font files that next/font can't provide (Revision R1, DECISIONS 25).

next/font/google self-hosts Instrument Serif and Instrument Sans for the site.
next/og (Satori) and the static OG renderer need real TTFs without variation
axes, so this script writes:
  assets/fonts/InstrumentSerif-Regular.ttf, InstrumentSerif-Italic.ttf  (as published)
  assets/fonts/InstrumentSans-500.ttf, InstrumentSans-650.ttf          (static instances)
and copies Departure Mono v1.500 (official GitHub release) to
public/fonts/DepartureMono.woff2.

Usage (from the repo root, inside the uv venv): python3 scripts/make_fonts.py <workdir>
"""
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GF = "https://github.com/google/fonts/raw/main/ofl"
SERIF = {"InstrumentSerif-Regular.ttf": f"{GF}/instrumentserif/InstrumentSerif-Regular.ttf",
         "InstrumentSerif-Italic.ttf": f"{GF}/instrumentserif/InstrumentSerif-Italic.ttf"}
SANS_VF = f"{GF}/instrumentsans/InstrumentSans%5Bwdth,wght%5D.ttf"
DEPARTURE = "https://github.com/rektdeckard/departure-mono/releases/download/v1.500/DepartureMono-1.500.zip"


def fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        with urllib.request.urlopen(url) as r:
            dest.write_bytes(r.read())
    return dest


def main() -> None:
    work = Path(sys.argv[1]).expanduser()
    work.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parent.parent
    out = root / "assets/fonts"
    out.mkdir(parents=True, exist_ok=True)
    for name, url in SERIF.items():
        (out / name).write_bytes(fetch(url, work / name).read_bytes())
    vf = fetch(SANS_VF, work / "InstrumentSans-VF.ttf")
    for w in (500, 650):
        inst = instancer.instantiateVariableFont(TTFont(vf), {"wght": w, "wdth": 100})
        inst.save(out / f"InstrumentSans-{w}.ttf")
    z = zipfile.ZipFile(io.BytesIO(fetch(DEPARTURE, work / "DepartureMono.zip").read_bytes()))
    name = next(n for n in z.namelist() if n.lower().endswith(".woff2"))
    (root / "public/fonts/DepartureMono.woff2").write_bytes(z.read(name))
    for p in sorted(out.glob("Instrument*.ttf")):
        print(p.relative_to(root), p.stat().st_size)


if __name__ == "__main__":
    main()
