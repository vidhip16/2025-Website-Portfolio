// Unit tests for the page palette's pure part (components/room/paletteMath.ts). Project "unit":
// Node only, no browser. The point: the page may rest only on one of the two complete palettes, so
// text contrast at rest is the tokens' own, not a mix of them (WCAG 1.4.3). Colours are read from
// app/globals.css, so a token change is checked too.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FADE_S, NIGHT_AT, isNight, veilBlend } from "../../components/room/paletteMath";

type Rgb = [number, number, number];

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
function token(name: string): Rgb {
  const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} is not a hex token in app/globals.css`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const paper = token("paper");
const ink = token("ink");
const night = token("night");
const moon = token("moon");

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const mix = (a: Rgb, b: Rgb, n: number): Rgb => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * n) as Rgb;
const sweep = (fn: (n: number) => void) => {
  for (let i = 0; i <= 1000; i++) fn(i / 1000);
};

test.describe("palette: two complete palettes, never a mix at rest", () => {
  test("both palettes pass AA on their own", () => {
    expect(contrast(ink, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(moon, night)).toBeGreaterThanOrEqual(4.5);
  });

  test("the scrubbed mix this replaces fell under AA across the middle of the tween", () => {
    // Finding a11y/wcag-1.4.3: text and ground interpolated together meet at the midpoint.
    let failing = 0;
    sweep((n) => {
      if (contrast(mix(ink, moon, n), mix(paper, night, n)) < 4.5) failing++;
    });
    expect(failing / 1001).toBeGreaterThan(0.4);
    expect(contrast(mix(ink, moon, 0.5), mix(paper, night, 0.5))).toBeLessThan(1.1);
  });

  test("whatever the scroll amount, the palette the page rests on has AA text contrast", () => {
    sweep((n) => {
      const [fg, bg] = isNight(n) ? [moon, night] : [ink, paper];
      expect(contrast(fg, bg), `n = ${n}`).toBeGreaterThanOrEqual(4.5);
    });
  });

  test("night is wanted from the midpoint on, and nowhere else", () => {
    expect(NIGHT_AT).toBe(0.5);
    expect(isNight(0)).toBe(false);
    expect(isNight(0.499)).toBe(false);
    expect(isNight(0.5)).toBe(true);
    expect(isNight(1)).toBe(true);
  });

  test("the fade is short and time-based", () => {
    expect(FADE_S).toBeGreaterThanOrEqual(0.2);
    expect(FADE_S).toBeLessThanOrEqual(0.3);
  });

  test("during a desktop fade (ground mixing, text flipping at the midpoint) the worst moment stays above 3 : 1", () => {
    let worst = Infinity;
    sweep((n) => {
      worst = Math.min(worst, contrast(isNight(n) ? moon : ink, mix(paper, night, n)));
    });
    expect(worst).toBeGreaterThan(3);
  });
});

test.describe("palette: veil blend", () => {
  test("body plus veil composite to the same ground as the mix, at every n", () => {
    sweep((n) => {
      const { night: dark, opacity } = veilBlend(n);
      const body = dark ? night : paper;
      const veil = dark ? paper : night;
      const composite = mix(body, veil, opacity);
      const want = mix(paper, night, n);
      for (let i = 0; i < 3; i++) expect(composite[i], `n = ${n}`).toBeCloseTo(want[i], 6);
    });
  });

  test("at rest the veil is off, and the text colour flips once, at the midpoint", () => {
    expect(veilBlend(0)).toEqual({ night: false, opacity: 0 });
    expect(veilBlend(1)).toEqual({ night: true, opacity: 0 });
    let flips = 0;
    let last = veilBlend(0).night;
    sweep((n) => {
      const now = veilBlend(n).night;
      if (now !== last) flips++;
      last = now;
    });
    expect(flips).toBe(1);
    expect(veilBlend(0.499).night).toBe(false);
    expect(veilBlend(0.5).night).toBe(true);
  });
});
