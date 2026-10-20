"""Build the procedural-gaze assets (blueprint §4.5, chosen in DECISIONS 21).

Inputs (all native master resolution, pixel-aligned):
  master.png        pupils centred (scripts/center_pupils.py)
  master-blank.png  same, pupils removed
  master.json       eye geometry from center_pupils.py
  body.png/.json    keyed body + crop box (scripts/key_body.py)
  blink.png happy.png  H5 edits of the master (re-rendered; registered here)

Outputs in <out_dir> (copied to public/ping/ by the lead):
  ping-body.png     RGBA body still, pupils centred (LCP image, no-JS)
  eyes-blank.webp   RGBA strip: both eye domes without pupils
  pupil-l.webp, pupil-r.webp  RGBA rendered pupil sprites (with highlight)
  eyes-blink.webp, eyes-happy.webp  RGBA strips, same rect as eyes-blank
  gaze.json         geometry in % of the body box (→ content/gaze.json)
  sheet.png         contact sheet for review

Usage: python3 scripts/build_gaze_assets.py <master_dir> <body.png> <blink.png> <happy.png> <out_dir>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

WEBP = [cv2.IMWRITE_WEBP_QUALITY, 90]


def dome_mask(shape, eye, grow=0.0, feather=1.5):
    m = np.zeros(shape, np.float32)
    (cx, cy), (a, b), ang = eye
    cv2.ellipse(m, ((cx, cy), (a * (1 + grow), b * (1 + grow)), ang), 1.0, -1, lineType=cv2.LINE_AA)
    return cv2.GaussianBlur(m, (0, 0), feather) if feather else m


def register(src, ref, rect):
    """Translate `src` so its eye strip lines up with `ref` (ECC, translation only)."""
    x, y, w, h = rect
    a = cv2.cvtColor(ref[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY).astype(np.float32)
    b = cv2.cvtColor(src[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY).astype(np.float32)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_TRANSLATION,
                                       (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), None, 5)
    except cv2.error:
        pass
    out = cv2.warpAffine(src, warp, (src.shape[1], src.shape[0]),
                         flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return out, [float(warp[0, 2]), float(warp[1, 2])]


def match_ring(src, ref, eye):
    """Per-channel mean/std match of `src` to `ref`, measured on a 12 px ring around the dome."""
    shape = ref.shape[:2]
    outer = dome_mask(shape, eye, grow=0.0, feather=0) > 0.5
    inner = cv2.erode(outer.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    ring = outer & ~inner
    out = src.astype(np.float32).copy()
    for c in range(3):
        s, r = src[..., c][ring].astype(np.float32), ref[..., c][ring].astype(np.float32)
        out[..., c] = (out[..., c] - s.mean()) * (r.std() / max(s.std(), 1e-3)) + r.mean()
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    mdir, body_p, blink_p, happy_p, out = (Path(p).expanduser() for p in sys.argv[1:6])
    out.mkdir(parents=True, exist_ok=True)
    master = cv2.imread(str(mdir / "master.png"))
    blank = cv2.imread(str(mdir / "master-blank.png"))
    geo = [g for g in json.loads((mdir / "master.json").read_text()) if "eye_centre" in g]
    body = cv2.imread(str(body_p), cv2.IMREAD_UNCHANGED)
    crop = json.loads(body_p.with_suffix(".json").read_text())["crop"]
    bx, by, bw, bh = crop
    shape = master.shape[:2]

    eyes = [((g["eye_centre"][0], g["eye_centre"][1]), tuple(g["eye_axes"]), g["eye_angle"]) for g in geo]
    eyes.sort(key=lambda e: e[0][0])

    # Strip rect: union of both domes + 18% padding (as blueprint §4.1 step 8).
    xs, ys = [], []
    for (cx, cy), (a, b), _ in eyes:
        r = max(a, b) / 2
        xs += [cx - r, cx + r]
        ys += [cy - r, cy + r]
    pw, ph = (max(xs) - min(xs)) * 0.18, (max(ys) - min(ys)) * 0.18
    sx0, sy0 = int(min(xs) - pw), int(min(ys) - ph)
    sx1, sy1 = int(max(xs) + pw) + 1, int(max(ys) + ph) + 1
    strip = (int(sx0), int(sy0), int(sx1 - sx0), int(sy1 - sy0))

    domes = np.clip(sum(dome_mask(shape, e, grow=0.02, feather=1.5) for e in eyes), 0, 1)

    def strip_rgba(img, alpha):
        s = img[sy0:sy1, sx0:sx1]
        a = (alpha[sy0:sy1, sx0:sx1] * 255).astype(np.uint8)
        return np.dstack([s, a])

    cv2.imwrite(str(out / "eyes-blank.webp"), strip_rgba(blank, domes), WEBP)

    # H5 strips: register to the master, match colour on the ring, keep dome interiors.
    reg = {}
    for name, p in (("blink", blink_p), ("happy", happy_p)):
        src = cv2.imread(str(p))
        if src.shape[:2] != shape:
            src = cv2.resize(src, (shape[1], shape[0]), interpolation=cv2.INTER_AREA)
        src, shift = register(src, master, strip)
        matched = src.copy()
        for e in eyes:
            m = dome_mask(shape, e, grow=0.06, feather=0)[..., None]
            matched = (match_ring(src, master, e) * m + matched * (1 - m)).astype(np.uint8)
        alpha = np.clip(sum(dome_mask(shape, e, grow=0.0, feather=2.0) for e in eyes), 0, 1)
        cv2.imwrite(str(out / f"eyes-{name}.webp"), strip_rgba(matched, alpha), WEBP)
        d = np.abs(src.astype(int) - master.astype(int)).max(2)
        ring_only = (np.clip(sum(dome_mask(shape, e, grow=0.25, feather=0) for e in eyes), 0, 1) > 0) & ~(domes > 0.01)
        reg[name] = {"shift": [round(v, 2) for v in shift], "ring_diff_mean": round(float(d[ring_only].mean()), 2)}

    # Pupil sprites: master minus blank isolates the pupil; soft alpha from that difference.
    diff = np.abs(master.astype(int) - blank.astype(int)).max(2).astype(np.float32)
    pupils = []
    for i, e in enumerate(eyes):
        (cx, cy), (a, b), ang = e
        r = int(max(a, b) / 2)
        x0, y0 = int(cx - r), int(cy - r)
        roi_d = diff[y0:y0 + 2 * r, x0:x0 + 2 * r]
        mask = (roi_d > 24).astype(np.uint8)
        n, lab, st, ce = cv2.connectedComponentsWithStats(mask)
        k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        hull = cv2.convexHull(np.argwhere(lab == k)[:, ::-1].astype(np.int32))
        pm = np.zeros(mask.shape, np.uint8)
        cv2.drawContours(pm, [hull], -1, 255, -1, lineType=cv2.LINE_AA)
        pm = cv2.dilate(pm, np.ones((3, 3), np.uint8))
        pm = cv2.GaussianBlur(pm.astype(np.float32), (0, 0), 1.0)
        ys_, xs_ = np.where(pm > 2)
        px0, py0, px1, py1 = xs_.min(), ys_.min(), xs_.max() + 1, ys_.max() + 1
        sprite = np.dstack([master[y0 + py0:y0 + py1, x0 + px0:x0 + px1], pm[py0:py1, px0:px1].astype(np.uint8)])
        cv2.imwrite(str(out / f"pupil-{'lr'[i]}.webp"), sprite, WEBP)
        # sprite centre relative to dome centre (≈0 after centring)
        scx, scy = x0 + (px0 + px1) / 2, y0 + (py0 + py1) / 2
        pupils.append({"w": int(px1 - px0), "h": int(py1 - py0), "off": [float(scx - cx), float(scy - cy)]})

    # Body still.
    cv2.imwrite(str(out / "ping-body.png"), body, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    assert body[0, 0, 3] == 0 and body[-1, -1, 3] == 0, "corner pixel must be transparent"

    # Geometry in % of the body box.
    X = lambda v: round((v - bx) / bw * 100, 4)
    Y = lambda v: round((v - by) / bh * 100, 4)
    W = lambda v: round(v / bw * 100, 4)
    H = lambda v: round(v / bh * 100, 4)
    eye_out = []
    for e, p in zip(eyes, pupils):
        (cx, cy), (a, b), ang = e
        rp = (p["w"] + p["h"]) / 4  # pupil radius, px
        # Pupil-centre travel ellipse: dome semi-axes minus pupil radius minus a 6% rim.
        tx, ty = max(a / 2 - rp - 0.06 * a / 2, 1), max(b / 2 - rp - 0.06 * b / 2, 1)
        eye_out.append({
            "c": [X(cx), Y(cy)], "r": [W(a / 2), H(b / 2)], "rot": round(ang, 2),
            "travel": [W(tx), H(ty)],
            "pupil": {"w": W(p["w"]), "h": H(p["h"]), "off": [W(p["off"][0]), H(p["off"][1])]},
        })
    mid = [(eyes[0][0][0] + eyes[1][0][0]) / 2, (eyes[0][0][1] + eyes[1][0][1]) / 2]
    eye_r = np.mean([(e[1][0] + e[1][1]) / 4 for e in eyes])
    travel = np.mean([[eo["travel"][0] * bw / 100, eo["travel"][1] * bh / 100] for eo in eye_out], axis=0)
    gaze = {
        "v": 2,
        "mode": "procedural",
        "stepDeg": 5,
        "dir": "cw",
        "box": {"w": int(bw), "h": int(bh)},
        "strip": {"x": X(sx0), "y": Y(sy0), "w": W(sx1 - sx0), "h": H(sy1 - sy0)},
        "stripPx": {"w": int(sx1 - sx0), "h": int(sy1 - sy0)},
        "eyeMid": [X(mid[0]), Y(mid[1])],
        "eyeR": round(float(eye_r / bh), 5),
        "ellipse": [round(float(travel[0] / bh), 5), round(float(travel[1] / bh), 5)],
        "eyes": eye_out,
        "sprites": {
            "body": "/ping/ping-body.png",
            "blank": "/ping/eyes-blank.webp",
            "pupilL": "/ping/pupil-l.webp",
            "pupilR": "/ping/pupil-r.webp",
            "blink": "/ping/eyes-blink.webp",
            "happy": "/ping/eyes-happy.webp",
        },
    }
    (out / "gaze.json").write_text(json.dumps(gaze, indent=2))
    (out / "build-report.json").write_text(json.dumps({"crop": crop, "strip_px": strip, "h5": reg, "pupils": pupils}, indent=2))

    # Contact sheet: body, blank, 8 directions + centre, blink, happy.
    def render(angle=None, layer=None):
        canvas = master.copy()
        if layer is not None:
            s = cv2.imread(str(out / layer), cv2.IMREAD_UNCHANGED)
            a = s[..., 3:4] / 255
            canvas[sy0:sy1, sx0:sx1] = (s[..., :3] * a + canvas[sy0:sy1, sx0:sx1] * (1 - a)).astype(np.uint8)
        if angle is not None:
            s = cv2.imread(str(out / "eyes-blank.webp"), cv2.IMREAD_UNCHANGED)
            a = s[..., 3:4] / 255
            canvas[sy0:sy1, sx0:sx1] = (s[..., :3] * a + canvas[sy0:sy1, sx0:sx1] * (1 - a)).astype(np.uint8)
            for i, (e, eo) in enumerate(zip(eyes, eye_out)):
                sp = cv2.imread(str(out / f"pupil-{'lr'[i]}.webp"), cv2.IMREAD_UNCHANGED)
                (cx, cy) = e[0]
                tx, ty = eo["travel"][0] * bw / 100, eo["travel"][1] * bh / 100
                k = 0 if angle == "c" else 1
                th = 0 if angle == "c" else np.radians(angle)
                px, py = cx + k * tx * np.cos(th), cy + k * ty * np.sin(th)
                h_, w_ = sp.shape[:2]
                x0, y0 = int(round(px - w_ / 2)), int(round(py - h_ / 2))
                clip = dome_mask(shape, e, grow=-0.02, feather=1.0)[y0:y0 + h_, x0:x0 + w_][..., None]
                a = sp[..., 3:4] / 255 * clip
                canvas[y0:y0 + h_, x0:x0 + w_] = (sp[..., :3] * a + canvas[y0:y0 + h_, x0:x0 + w_] * (1 - a)).astype(np.uint8)
        return cv2.resize(canvas[sy0 - 40:sy1 + 40, sx0 - 40:sx1 + 40], None, fx=0.75, fy=0.75)

    tiles = [render("c")] + [render(a) for a in (270, 315, 0, 45, 90, 135, 180, 225)] + [render(layer="eyes-blink.webp"), render(layer="eyes-happy.webp"), render(layer="eyes-blank.webp")]
    rows = [np.hstack(tiles[i:i + 3]) for i in range(0, 12, 3)]
    cv2.imwrite(str(out / "sheet.png"), np.vstack(rows))
    print(json.dumps({"strip_px": strip, "h5": reg, "pupils": pupils, "eyeR": gaze["eyeR"], "ellipse": gaze["ellipse"]}, indent=2))


if __name__ == "__main__":
    main()
