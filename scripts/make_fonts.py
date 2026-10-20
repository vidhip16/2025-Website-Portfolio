"""Build the self-hosted font files.

Fraunces is pinned to a static instance (SOFT=100, opsz=144, WONK=0, wght 700-800):
  - public/fonts/fraunces-display.woff2  (Latin subset, next/font/local, preloaded)
  - assets/fonts/Fraunces-800.ttf        (static wght=800 TTF for next/og / Satori)
Departure Mono v1.500 (official GitHub release) is copied to public/fonts/DepartureMono.woff2.

Usage (from the repo root, inside the uv venv):
  python3 scripts/make_fonts.py <workdir>
<workdir> is a scratch directory outside the repo for the downloads.
"""
import io
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FRAUNCES_URL = (
    "https://github.com/google/fonts/raw/main/ofl/fraunces/"
    "Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf"
)
DEPARTURE_URL = (
    "https://github.com/rektdeckard/departure-mono/releases/download/"
    "v1.500/DepartureMono-1.500.zip"
)
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)


def fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        with urllib.request.urlopen(url) as r:
            dest.write_bytes(r.read())
    return dest


def main() -> None:
    work = Path(sys.argv[1]).expanduser()
    work.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parent.parent
    (root / "public/fonts").mkdir(parents=True, exist_ok=True)
    (root / "assets/fonts").mkdir(parents=True, exist_ok=True)

    src = fetch(FRAUNCES_URL, work / "Fraunces-VF.ttf")

    # Display instance: weight range kept as a (small) variable axis 700..800.
    vf = TTFont(src)
    disp = instancer.instantiateVariableFont(
        vf, {"SOFT": 100, "opsz": 144, "WONK": 0, "wght": (700, 800)}
    )
    disp_ttf = work / "fraunces-display.ttf"
    disp.save(disp_ttf)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(disp_ttf),
            f"--unicodes={LATIN}", "--flavor=woff2", "--layout-features=*",
            f"--output-file={root / 'public/fonts/fraunces-display.woff2'}",
        ],
        check=True,
    )

    # Static wght=800 TTF for next/og (Satori cannot set variation axes).
    vf = TTFont(src)
    og = instancer.instantiateVariableFont(
        vf, {"SOFT": 100, "opsz": 144, "WONK": 0, "wght": 800}
    )
    og_full = work / "Fraunces-800-full.ttf"
    og.save(og_full)
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(og_full),
            f"--unicodes={LATIN}", "--layout-features=kern,liga",
            f"--output-file={root / 'assets/fonts/Fraunces-800.ttf'}",
        ],
        check=True,
    )

    # Departure Mono v1.500: take the woff2 from the release zip.
    z = zipfile.ZipFile(io.BytesIO(fetch(DEPARTURE_URL, work / "DepartureMono.zip").read_bytes()))
    name = next(n for n in z.namelist() if n.lower().endswith(".woff2"))
    (root / "public/fonts/DepartureMono.woff2").write_bytes(z.read(name))

    for p in ["public/fonts/fraunces-display.woff2", "assets/fonts/Fraunces-800.ttf",
              "public/fonts/DepartureMono.woff2"]:
        print(p, (root / p).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
