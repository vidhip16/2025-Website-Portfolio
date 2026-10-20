"""Cut Ping out of the flat #00FF00 background (blueprint §4.1 step 6).

Local chroma key: alpha from green dominance, spill suppressed, then the
blueprint's 1 px erode + 1 px feather. Writes an RGBA PNG at the source's
native resolution (never upsampled), cropped to the subject + margin, and a
JSON with the crop box so eye geometry can be mapped into the cropped frame.

Usage: python3 scripts/key_body.py <source.png> <out.png> [margin_px]
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def key(im: np.ndarray) -> np.ndarray:
    f = im.astype(np.float32)
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    # Green dominance: 0 on the subject, large on the screen.
    dom = g - np.maximum(r, b)
    alpha = 1.0 - np.clip((dom - 18.0) / (90.0 - 18.0), 0.0, 1.0)
    # Despill: never let green exceed the larger of red/blue.
    g2 = np.minimum(g, np.maximum(r, b))
    out = np.dstack([b, g2, r, alpha * 255.0])
    return out


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    margin = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    im = cv2.imread(str(src))
    rgba = key(im)
    a = rgba[..., 3].astype(np.uint8)
    # Hard core + 1 px erode + 1 px feather.
    a = cv2.erode(a, np.ones((3, 3), np.uint8), iterations=1)
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.8)
    a[a < 4] = 0
    rgba[..., 3] = a
    # Remove stray specks: keep the largest connected component.
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 8).astype(np.uint8))
    if n > 2:
        keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        rgba[..., 3][lab != keep] = 0
    ys, xs = np.where(rgba[..., 3] > 8)
    x0, y0 = max(0, xs.min() - margin), max(0, ys.min() - margin)
    x1, y1 = min(im.shape[1], xs.max() + 1 + margin), min(im.shape[0], ys.max() + 1 + margin)
    crop = np.clip(rgba[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    crop[..., :3][crop[..., 3] == 0] = 0
    cv2.imwrite(str(dst), crop)
    meta = {"source": src.name, "source_size": [im.shape[1], im.shape[0]], "crop": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
            "corner_alpha": int(crop[0, 0, 3])}
    dst.with_suffix(".json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
