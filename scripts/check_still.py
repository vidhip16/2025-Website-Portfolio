"""Stillness gate for a gaze clip (blueprint §4.1 step 4).

Everything except the pupils must stay frozen. For each frame:
  1. register it to frame 0 with cv2.phaseCorrelate and record (dx, dy);
  2. undo that shift and measure |frame - frame0| outside the dilated eye mask.
Fail if any |shift| > 1.5 px, or the mean diff in excess of the clip's own
noise floor >= 1.5/255, or p99 diff >= 12/255. The noise floor is the mean
frame-to-frame diff of the flat chroma background, which contains no motion:
H.264 delivery alone puts it at ~5/255, so a raw 1.5/255 mean is unreachable.

Usage: python3 scripts/check_still.py <frames_dir> <out.json>
  <frames_dir> holds lossless PNG frames (ffmpeg -an -fps_mode cfr -r 24 frames/%04d.png).
Exit code 0 = pass, 1 = fail.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

MAX_SHIFT = 1.5
MAX_MEAN = 1.5
MAX_P99 = 12.0


def eye_mask(frame0: np.ndarray, dilate: float = 0.25) -> tuple[np.ndarray, list]:
    """The two eye domes: near-white (low saturation, high value), round blobs of
    similar size side by side. Returned as ellipses dilated by 25%."""
    hsv = cv2.cvtColor(frame0, cv2.COLOR_BGR2HSV)
    best = None
    for s_max in (22, 28, 35, 45):
        white = ((hsv[..., 2] > 205) & (hsv[..., 1] < s_max)).astype(np.uint8) * 255
        white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
        contours, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cands = []
        for c in contours:
            a = cv2.contourArea(c)
            if a < 400 or len(c) < 5:
                continue
            per = cv2.arcLength(c, True)
            circ = 4 * np.pi * a / (per * per)
            hull = cv2.convexHull(c)
            if circ > 0.55 or cv2.contourArea(hull) and a / cv2.contourArea(hull) > 0.85:
                cands.append((a, c))
        cands.sort(key=lambda t: -t[0])
        # pick the largest pair with similar areas and similar heights
        for i in range(len(cands)):
            for j in range(i + 1, len(cands)):
                (a1, c1), (a2, c2) = cands[i], cands[j]
                (x1, y1), _, _ = cv2.fitEllipse(c1)
                (x2, y2), _, _ = cv2.fitEllipse(c2)
                if 0.6 < a1 / a2 < 1.67 and abs(y1 - y2) < 0.15 * frame0.shape[0] and abs(x1 - x2) > 20:
                    best = (cv2.convexHull(c1), cv2.convexHull(c2))
                    break
            if best:
                break
        if best:
            break
    if not best:
        raise SystemExit("eye domes not found in frame 0")
    mask = np.zeros(frame0.shape[:2], np.uint8)
    ellipses = []
    for c in best:
        (cx, cy), (a, b), ang = cv2.fitEllipse(c)
        ellipses.append({"centre": [cx, cy], "axes": [a, b], "angle": ang})
        cv2.ellipse(mask, ((cx, cy), (a * (1 + dilate), b * (1 + dilate)), ang), 255, -1)
    ellipses.sort(key=lambda e: e["centre"][0])
    return mask, ellipses


def subject_gray(im: np.ndarray, eyes: np.ndarray) -> np.ndarray:
    """Greyscale with the chroma-green background AND the eye domes flattened, so
    phase correlation registers the (supposedly frozen) body, not codec noise in
    the background or the pupils, which are meant to move."""
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    flat = ((hsv[..., 0] > 35) & (hsv[..., 0] < 85) & (hsv[..., 1] > 120)) | (eyes > 0)
    g = np.float32(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY))
    g[flat] = float(g[~flat].mean()) if (~flat).any() else 0.0
    return g


def main() -> None:
    frames = sorted(Path(sys.argv[1]).glob("*.png"))
    out = Path(sys.argv[2])
    f0 = cv2.imread(str(frames[0]))
    mask, ellipses = eye_mask(f0)
    outside = mask == 0
    g0 = subject_gray(f0, mask)
    win = cv2.createHanningWindow(g0.shape[::-1], cv2.CV_32F)
    h, w = g0.shape

    hsv0 = cv2.cvtColor(f0, cv2.COLOR_BGR2HSV)
    flat_bg = cv2.erode(
        (((hsv0[..., 0] > 35) & (hsv0[..., 0] < 85) & (hsv0[..., 1] > 120)) & outside).astype(np.uint8),
        np.ones((25, 25), np.uint8),
    ) > 0
    subject = outside & ~flat_bg
    shifts, means, p99s, samples, floors = [], [], [], [], []
    rng = np.random.default_rng(1729)
    idx = rng.choice(int(outside.sum()), size=min(20000, int(outside.sum())), replace=False)
    for f in frames:
        im = cv2.imread(str(f))
        g = subject_gray(im, mask)
        (dx, dy), _ = cv2.phaseCorrelate(g0, g, win)
        shifts.append([round(float(dx), 3), round(float(dy), 3)])
        T = np.float32([[1, 0, -dx], [0, 1, -dy]])
        reg = cv2.warpAffine(im, T, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        full = np.abs(reg.astype(np.int16) - f0.astype(np.int16)).max(axis=2)
        floors.append(float(full[flat_bg].mean()) if flat_bg.any() else 0.0)
        d = full[outside]
        means.append(float(d.mean()))
        p99s.append(float(np.percentile(d, 99)))
        samples.append(d[idx])

    pooled = np.concatenate(samples)
    max_shift = max(max(abs(a), abs(b)) for a, b in shifts)
    result = {
        "frames": len(frames),
        "size": [w, h],
        "eyes": ellipses,
        "max_abs_shift": round(max_shift, 3),
        "mean_diff": round(float(np.mean(means)), 3),
        "noise_floor": round(float(np.mean(floors)), 3),
        "excess_mean": round(float(np.mean(means) - np.mean(floors)), 3),
        "p99_diff": round(float(np.percentile(pooled, 99)), 3),
        "worst_frame_mean": round(max(means), 3),
        "worst_frame_p99": round(max(p99s), 3),
        "shifts": shifts,
        "per_frame_mean": [round(m, 3) for m in means],
        "thresholds": {"shift": MAX_SHIFT, "mean": MAX_MEAN, "p99": MAX_P99},
    }
    result["pass"] = bool(
        max_shift <= MAX_SHIFT and result["excess_mean"] < MAX_MEAN and result["p99_diff"] < MAX_P99
    )
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps({k: v for k, v in result.items() if k not in ("shifts", "per_frame_mean", "eyes")}, indent=2))
    sys.exit(0 if result["pass"] else 1)


if __name__ == "__main__":
    main()
