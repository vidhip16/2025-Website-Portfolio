// The page palette's state machine (components/room/palette.ts) on a stubbed DOM, with the real
// GSAP. Project "unit": Node only. It pins the behaviour the round-1 contrast finding needs: the
// body is only ever on paper + ink, on night + moon, or in a short time-based fade between them.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { FADE_S } from "../../components/room/paletteMath";

// roomStage.ts imports "@/lib/stage", and the Playwright loader does not map tsconfig paths for
// files outside tests/ (see the note in tests/e2e/helpers.ts). Map the alias for this file only.
type Resolver = { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolver = Module as unknown as Resolver;
const resolveFilename = resolver._resolveFilename;
resolver._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  const mapped = request.startsWith("@/") ? path.join(process.cwd(), request.slice(2)) : request;
  return resolveFilename.call(this, mapped, ...rest);
};

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
const TOKENS: Record<string, string> = {
  "--paper": hex("paper"),
  "--ink": hex("ink"),
  "--night": hex("night"),
  "--moon": hex("moon"),
};

class Style {
  private values = new Map<string, string>();
  [prop: string]: unknown;
  setProperty(name: string, value: string) {
    this.values.set(name, value);
  }
  getPropertyValue(name: string) {
    return this.values.get(name) ?? "";
  }
  removeProperty(name: string) {
    const old = this.getPropertyValue(name);
    this.values.delete(name);
    return old;
  }
  get size() {
    return this.values.size;
  }
}

type FakeEl = {
  style: Style;
  dataset: Record<string, string | undefined>;
  attrs: Record<string, string>;
  setAttribute(name: string, value: string): void;
  remove(): void;
};

function installDom() {
  const children: FakeEl[] = [];
  const el = (): FakeEl => {
    const e: FakeEl = {
      style: new Style(),
      dataset: {},
      attrs: {},
      setAttribute(name, value) {
        e.attrs[name] = value;
      },
      remove() {
        const i = children.indexOf(e);
        if (i >= 0) children.splice(i, 1);
      },
    };
    return e;
  };
  const body = Object.assign(el(), {
    prepend(child: FakeEl) {
      children.unshift(child);
    },
  });
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { body, documentElement: {}, createElement: el };
  g.getComputedStyle = () => ({ getPropertyValue: (name: string) => TOKENS[name] ?? "" });
  return { body, veils: () => children };
}

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** GSAP hands back the end colours as written (hex) and the blends as rgba(). */
const rgb = (value: string): [number, number, number] => {
  if (/^#[0-9a-f]{6}$/i.test(value)) return hexRgb(value);
  const m = value.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) throw new Error(`not a colour: "${value}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const near = (a: [number, number, number], b: [number, number, number]) =>
  a.every((v, i) => Math.abs(v - b[i]) <= 1);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const REST_MS = FADE_S * 1000 + 250;

const bg = (b: { style: Style }) => b.style.getPropertyValue("--bg");
const fg = (b: { style: Style }) => b.style.getPropertyValue("--fg");

test.describe.configure({ mode: "serial" });

test.describe("palette controller", () => {
  // An acquire within ~100 ms of the last release is a rebuild and carries the palette on, so let
  // that window pass between tests.
  test.afterEach(async () => {
    await wait(130);
  });

  test("a change fades to the other palette in time and then rests on it, complete", async () => {
    const { body } = installDom();
    const { acquirePalette } = await import("../../components/room/palette");
    const palette = acquirePalette(false);
    palette.set(false);
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--paper"]))).toBe(true);
    expect(near(rgb(fg(body)), hexRgb(TOKENS["--ink"]))).toBe(true);

    palette.set(true);
    const seen: string[] = [];
    const lumas: number[] = [];
    for (let t = 0; t < REST_MS; t += 12) {
      await wait(12);
      seen.push(fg(body));
      lumas.push(rgb(bg(body))[0]);
    }
    // The ground only ever darkens, the text colour flips once, and both end on night + moon.
    for (let i = 1; i < lumas.length; i++) expect(lumas[i]).toBeLessThanOrEqual(lumas[i - 1] + 1);
    expect(new Set(seen).size).toBeLessThanOrEqual(2);
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--night"]))).toBe(true);
    expect(near(rgb(fg(body)), hexRgb(TOKENS["--moon"]))).toBe(true);
    // And it does not drift once the fade is over.
    const rested = bg(body);
    await wait(150);
    expect(bg(body)).toBe(rested);
    palette.release();
  });

  test("a change back while fading turns around and ends on paper", async () => {
    const { body } = installDom();
    const { acquirePalette } = await import("../../components/room/palette");
    const palette = acquirePalette(false);
    palette.set(true);
    await wait(90);
    palette.set(false);
    await wait(REST_MS);
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--paper"]))).toBe(true);
    expect(near(rgb(fg(body)), hexRgb(TOKENS["--ink"]))).toBe(true);
    palette.release();
  });

  test("the last release leaves the body to the stylesheet; an earlier one does not", async () => {
    const { body } = installDom();
    const { acquirePalette } = await import("../../components/room/palette");
    const hero = acquirePalette(false);
    const room = acquirePalette(false);
    hero.set(true);
    await wait(REST_MS);
    hero.release();
    hero.set(false); // a released handle is inert
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--night"]))).toBe(true);
    room.release();
    expect(body.style.size).toBe(0);
    await wait(50);
    expect(body.style.size).toBe(0);
  });

  test("a release and an acquire in the same breath is a rebuild: no flash of paper", async () => {
    const { body } = installDom();
    const { acquirePalette } = await import("../../components/room/palette");
    const first = acquirePalette(false);
    first.set(true);
    await wait(REST_MS);
    first.release();
    const second = acquirePalette(false);
    second.set(true);
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--night"]))).toBe(true);
    expect(near(rgb(fg(body)), hexRgb(TOKENS["--moon"]))).toBe(true);
    second.release();
  });

  test("phones: body holds one palette, the veil carries the blend and is off at rest", async () => {
    const { body, veils } = installDom();
    const { acquirePalette } = await import("../../components/room/palette");
    const palette = acquirePalette(true);
    palette.set(false);
    expect(veils().length).toBe(0); // paper at rest needs no veil
    palette.set(true);
    await wait(FADE_S * 500);
    expect(veils().length).toBe(1);
    await wait(REST_MS);
    const [veil] = veils();
    expect(Number(veil.style.opacity)).toBe(0);
    expect(near(rgb(bg(body)), hexRgb(TOKENS["--night"]))).toBe(true);
    expect(near(rgb(fg(body)), hexRgb(TOKENS["--moon"]))).toBe(true);
    palette.release();
    expect(veils().length).toBe(0);
    expect(body.style.size).toBe(0);
  });
});
