"""Key and export the secondary Ping stills (H6, H7) and the OG art (H9).

  stills:   python3 scripts/process_stills.py still <src.png> <out.webp> <max_side>
  stickers: python3 scripts/process_stills.py sheet <sheet.png> <out_dir> <max_side> name1,name2,...
            (panels are found as connected components, ordered row by row)
  og:       python3 scripts/process_stills.py og <src.png> <out.jpg>   (crops to 1200x630)

Keying reuses scripts/key_body.py (green dominance, despill, 1 px erode + feather).
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from key_body import key  # noqa: E402

WEBP = [cv2.IMWRITE_WEBP_QUALITY, 86]


def keyed(src: np.ndarray) -> np.ndarray:
    rgba = key(src)
    a = rgba[..., 3].astype(np.uint8)
    a = cv2.erode(a, np.ones((3, 3), np.uint8))
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.8)
    a[a < 4] = 0
    rgba[..., 3] = a
    return rgba


def fit(rgba: np.ndarray, box, max_side: int, margin: int = 12) -> np.ndarray:
    x, y, w, h = box
    H, W = rgba.shape[:2]
    x0, y0, x1, y1 = max(0, x - margin), max(0, y - margin), min(W, x + w + margin), min(H, y + h + margin)
    crop = np.clip(rgba[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    s = min(1.0, max_side / max(crop.shape[:2]))
    if s < 1:
        crop = cv2.resize(crop, (round(crop.shape[1] * s), round(crop.shape[0] * s)), interpolation=cv2.INTER_AREA)
    crop[..., :3][crop[..., 3] == 0] = 0
    return crop


def main() -> None:
    mode = sys.argv[1]
    src = cv2.imread(sys.argv[2])
    if mode == "og":
        h, w = src.shape[:2]
        ch = round(w * 630 / 1200)
        crop = src[h - ch:h, :] if ch <= h else src
        cv2.imwrite(sys.argv[3], cv2.resize(crop, (1200, 630), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 86])
        print(sys.argv[3])
        return
    rgba = keyed(src)
    alpha = (rgba[..., 3] > 8).astype(np.uint8)
    n, lab, st, ce = cv2.connectedComponentsWithStats(alpha)
    comps = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.02 * alpha.size / 7]
    if mode == "still":
        k = max(comps, key=lambda i: st[i, cv2.CC_STAT_AREA])
        rgba[..., 3][lab != k] = 0
        out = fit(rgba, st[k, :4], int(sys.argv[4]))
        cv2.imwrite(sys.argv[3], out, WEBP)
        print(sys.argv[3], out.shape, out[0, 0, 3])
        return
    if mode == "sheet":
        out_dir = Path(sys.argv[3])
        out_dir.mkdir(parents=True, exist_ok=True)
        names = sys.argv[5].split(",")
        rows = sorted(comps, key=lambda i: ce[i][1])
        # group into rows by y-centre, then sort each row by x
        groups, cur = [], []
        for i in rows:
            if cur and abs(ce[i][1] - ce[cur[0]][1]) > st[cur[0], cv2.CC_STAT_HEIGHT] * 0.5:
                groups.append(cur)
                cur = []
            cur.append(i)
        groups.append(cur)
        ordered = [i for g in groups for i in sorted(g, key=lambda j: ce[j][0])]
        for name, i in zip(names, ordered):
            m = rgba.copy()
            m[..., 3][lab != i] = 0
            out = fit(m, st[i, :4], int(sys.argv[4]))
            cv2.imwrite(str(out_dir / f"{name}.webp"), out, WEBP)
            print(name, out.shape)


if __name__ == "__main__":
    main()
