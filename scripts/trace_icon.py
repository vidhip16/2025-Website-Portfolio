"""Trace Ping's head from the master alpha into the favicon SVGs (blueprint §1.5).

Writes app/icon.svg (eyes open) and public/icon-sleep.svg (closed eyes, used
while the tab is hidden). Head + ears silhouette: OpenCV findContours +
approxPolyDP (<= 40 points), drawn as a smoothed quadratic path. Lilac head
with a 1.5 px plum outline at a 32 px viewBox, pupils >= 3 px, on a plaster
rounded square that switches to ink under prefers-color-scheme: dark.

Usage: python3 scripts/trace_icon.py
"""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LILAC, PLUM, PLASTER, INK, PINK = "#B7A3F0", "#23162E", "#F6F1FA", "#23162E", "#FF86B5"
VB = 32.0
PAD = 2.2


def neck_row(alpha: np.ndarray, eye_y: int) -> int:
    """First narrow row below the eyes = where the head meets the body."""
    widths = (alpha > 128).sum(axis=1)
    below = widths[eye_y: eye_y + int(alpha.shape[0] * 0.25)]
    return eye_y + int(np.argmin(below))


def smooth_path(pts: np.ndarray) -> str:
    """Closed quadratic B-spline through midpoints (smooth, few points)."""
    n = len(pts)
    mids = [(pts[i] + pts[(i + 1) % n]) / 2 for i in range(n)]
    d = f"M{mids[-1][0]:.2f} {mids[-1][1]:.2f}"
    for i in range(n):
        p, m = pts[i], mids[i]
        d += f"Q{p[0]:.2f} {p[1]:.2f} {m[0]:.2f} {m[1]:.2f}"
    return d + "Z"


def trace(mask: np.ndarray, max_pts: int) -> np.ndarray:
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    eps = 0.002 * cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, eps, True)
    while len(approx) > max_pts:
        eps *= 1.15
        approx = cv2.approxPolyDP(c, eps, True)
    return approx[:, 0, :].astype(np.float64)


def main() -> None:
    body = cv2.imread(str(ROOT / "public/ping/ping-body.png"), cv2.IMREAD_UNCHANGED)
    gaze = json.loads((ROOT / "content/gaze.json").read_text())
    H, W = body.shape[:2]
    alpha = body[..., 3]
    eyes = [(e["c"][0] / 100 * W, e["c"][1] / 100 * H) for e in gaze["eyes"]]
    eye_y = int(np.mean([y for _, y in eyes]))
    cut = neck_row(alpha, eye_y)

    head = (alpha[:cut] > 128).astype(np.uint8) * 255
    head = cv2.morphologyEx(head, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    outline = trace(head, 40)

    # Inner ears: bubblegum pixels above the eyes.
    hsv = cv2.cvtColor(body[:cut, :, :3], cv2.COLOR_BGR2HSV)
    pink = (((hsv[..., 0] > 150) | (hsv[..., 0] < 8)) & (hsv[..., 1] > 90) & (alpha[:cut] > 200)).astype(np.uint8) * 255
    pink[int(eye_y - 0.12 * H):] = 0
    pink = cv2.morphologyEx(pink, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    ncomp, lab, st, _ = cv2.connectedComponentsWithStats(pink)
    ears = []
    for i in sorted(range(1, ncomp), key=lambda i: -st[i, cv2.CC_STAT_AREA])[:2]:
        if st[i, cv2.CC_STAT_AREA] > 0.002 * W * H:
            ears.append(trace((lab == i).astype(np.uint8) * 255, 12))

    x0, y0 = outline.min(axis=0)
    x1, y1 = outline.max(axis=0)
    s = (VB - 2 * PAD) / max(x1 - x0, y1 - y0)
    ox = (VB - (x1 - x0) * s) / 2 - x0 * s
    oy = (VB - (y1 - y0) * s) / 2 - y0 * s
    tf = lambda p: np.stack([p[:, 0] * s + ox, p[:, 1] * s + oy], axis=1)

    head_d = smooth_path(tf(outline))
    ear_d = "".join(smooth_path(tf(e)) for e in ears)
    eyes_t = [(x * s + ox, y * s + oy) for x, y in eyes]
    pupil_r = max(1.6, gaze["eyeR"] * H * 0.47 * s * 1.25)

    style = (
        f"<style>.bg{{fill:{PLASTER}}}.hd{{fill:{LILAC};stroke:{PLUM};stroke-width:1.5;stroke-linejoin:round}}"
        f".ear{{fill:{PINK}}}.pu{{fill:{PLUM}}}.lid{{fill:none;stroke:{PLUM};stroke-width:1.3;stroke-linecap:round}}"
        f"@media (prefers-color-scheme:dark){{.bg{{fill:{INK}}}.hd{{stroke:{LILAC}}}}}</style>"
    )

    def svg(eyes_markup: str) -> str:
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">{style}'
            f'<rect class="bg" width="32" height="32" rx="7"/>'
            f'<path class="hd" d="{head_d}"/><path class="ear" d="{ear_d}"/>{eyes_markup}</svg>\n'
        )

    open_eyes = "".join(f'<circle class="pu" cx="{x:.2f}" cy="{y:.2f}" r="{pupil_r:.2f}"/>' for x, y in eyes_t)
    w = pupil_r * 1.25
    closed = "".join(
        f'<path class="lid" d="M{x - w:.2f} {y - 0.3:.2f}Q{x:.2f} {y + w * 0.9:.2f} {x + w:.2f} {y - 0.3:.2f}"/>' for x, y in eyes_t
    )
    (ROOT / "app/icon.svg").write_text(svg(open_eyes))
    (ROOT / "public/icon-sleep.svg").write_text(svg(closed))
    print(json.dumps({"head_points": len(outline), "ear_points": [len(e) for e in ears], "neck_row": cut,
                      "pupil_r": round(pupil_r, 2), "eyes": [[round(v, 2) for v in e] for e in eyes_t]}))


if __name__ == "__main__":
    main()
