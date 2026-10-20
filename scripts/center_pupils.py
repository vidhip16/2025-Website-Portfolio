"""Local, deterministic H2 clean-up: centre each pupil in its eye dome.

Writes <out>/master.png (pupils exactly centred) and <out>/master-blank.png
(pupils and their highlights removed: plain white domes, for the procedural
fallback). Every pixel outside the two eye domes is untouched.

Usage: python3 scripts/center_pupils.py <source.png> <out_dir>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def find_eyes(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    white = ((hsv[..., 1] < 40) & (hsv[..., 2] > 200)).astype(np.uint8) * 255
    white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, _, st, ce = cv2.connectedComponentsWithStats(white)
    idx = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
    return sorted([tuple(int(v) for v in st[i, :4]) for i in idx], key=lambda b: b[0]), white


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    im = cv2.imread(str(src))
    master, blank = im.copy(), im.copy()
    boxes, white = find_eyes(im)
    report = []
    for (x, y, w, h) in boxes:
        pad = 12
        x0, y0, x1, y1 = x - pad, y - pad, x + w + pad, y + h + pad
        roi = im[y0:y1, x0:x1]
        g = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        _, dark = cv2.threshold(cv2.GaussianBlur(g, (5, 5), 0), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        inner = np.zeros_like(dark)
        cv2.ellipse(inner, ((pad + w / 2, pad + h / 2), (w * 0.9, h * 0.9), 0), 255, -1)
        dark &= inner
        cs, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        pupil = cv2.convexHull(max(cs, key=cv2.contourArea))  # hull fills the highlight hole
        pmask = np.zeros_like(dark)
        cv2.drawContours(pmask, [pupil], -1, 255, -1)
        M = cv2.moments(pmask, binaryImage=True)
        pcx, pcy = M["m10"] / M["m00"], M["m01"] / M["m00"]

        # Eye dome = white sclera + pupil; its fitted ellipse centre is the target.
        dome = (white[y0:y1, x0:x1] > 0).astype(np.uint8) * 255 | pmask
        dome = cv2.morphologyEx(dome, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        dc, _ = cv2.findContours(dome, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        (ecx, ecy), axes, ang = cv2.fitEllipse(max(dc, key=cv2.contourArea))

        # Blank sclera: inpaint the pupil (+ a little rim) from the surrounding dome.
        hole = cv2.dilate(pmask, np.ones((9, 9), np.uint8))
        sclera = cv2.inpaint(roi, hole, 9, cv2.INPAINT_TELEA)
        sclera = cv2.GaussianBlur(sclera, (0, 0), 1.2) * (hole[..., None] / 255) + roi * (1 - hole[..., None] / 255)
        sclera = sclera.astype(np.uint8)

        # Pupil patch with a feathered alpha, translated to the dome centre.
        alpha = cv2.GaussianBlur(cv2.dilate(pmask, np.ones((3, 3), np.uint8)).astype(np.float32) / 255, (0, 0), 1.0)
        dx, dy = ecx - pcx, ecy - pcy
        T = np.float32([[1, 0, dx], [0, 1, dy]])
        moved = cv2.warpAffine(roi, T, (roi.shape[1], roi.shape[0]), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        malpha = cv2.warpAffine(alpha, T, (roi.shape[1], roi.shape[0]), flags=cv2.INTER_LINEAR)[..., None]
        centred = (moved * malpha + sclera * (1 - malpha)).astype(np.uint8)

        master[y0:y1, x0:x1] = centred
        blank[y0:y1, x0:x1] = sclera
        r_eye = (axes[0] + axes[1]) / 4
        report.append({
            "box": [x0, y0, x1 - x0, y1 - y0],
            "eye_centre": [round(x0 + ecx, 2), round(y0 + ecy, 2)],
            "eye_axes": [round(a, 2) for a in axes], "eye_angle": round(ang, 2),
            "pupil_before": [round(x0 + pcx, 2), round(y0 + pcy, 2)],
            "shift": [round(dx, 2), round(dy, 2)],
            "pupil_r_over_eye_r": round(float(np.sqrt(cv2.countNonZero(pmask) / np.pi) / r_eye), 3),
        })
    cv2.imwrite(str(out / "master.png"), master)
    cv2.imwrite(str(out / "master-blank.png"), blank)
    diff = np.abs(master.astype(int) - im.astype(int)).max(axis=2)
    outside = np.ones(diff.shape, bool)
    for r in report:
        bx, by, bw, bh = r["box"]
        outside[by:by + bh, bx:bx + bw] = False
    report.append({"max_diff_outside_eyes": int(diff[outside].max())})
    (out / "master.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
