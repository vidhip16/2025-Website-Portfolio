import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
// Relative imports (not "@/") so the Playwright loader never depends on tsconfig paths.
import { getProjects } from "../../content/projects";

// ── Run target ────────────────────────────────────────────────────────────

/** True when the run targets a local server (form specs may submit, QA probes exist). */
export const isLocalBase = (baseURL?: string) =>
  !!baseURL && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

/** Call inside every @form spec: skip unless the base URL is local. */
export function skipUnlessLocal(baseURL?: string) {
  test.skip(!isLocalBase(baseURL), "@form specs only run against a local server");
}

/** Probe specs read window.__gaze/__dots/__perf, which only the local NEXT_PUBLIC_QA=1 build exposes. */
export function skipUnlessQaBuild(baseURL?: string) {
  test.skip(!isLocalBase(baseURL), "QA probes exist only in the local NEXT_PUBLIC_QA=1 build");
}

// ── Content the specs check against (verified entries only, like the pages) ──

export const PROJECTS = getProjects().map((p) => ({ slug: p.slug, title: p.title, repo: p.repo }));
export const SECTION_IDS = ["home", "about", "work", "experience", "contact"] as const;
/** Blueprint §12 gate 5 screenshot widths. */
export const LAYOUT_WIDTHS = [320, 390, 768, 1280, 1920] as const;
/** A sensible window height for each screenshot width. */
export const heightFor = (width: number) => (width < 768 ? 844 : width < 1280 ? 1024 : width < 1920 ? 800 : 1080);

export const SEL = {
  nav: 'header nav[aria-label="Primary"]',
  menuButton: 'button[aria-controls="nav-menu"]',
  menu: "#nav-menu[popover]",
  motionToggle: "button[data-motion-toggle][aria-pressed]",
  indexLink: "ol#work-index a[data-index-link]",
  mosaic: "[data-mosaic]",
  mosaicCol: "[data-mosaic] [data-mosaic-col]",
  track: "[data-mosaic] [data-track]",
  canonicalTile: "a[data-tile][data-canonical]",
  cloneGroup: "[data-mosaic] [data-clone]",
  viewToggle: "button[data-view-toggle][aria-pressed]",
  listView: "ul[data-list-view]",
  detailHero: "[data-detail-hero]",
  back: "a[data-back]",
  repo: "a[data-repo]",
  form: "form[data-contact-form]",
  status: '#contact [role="status"][aria-live="polite"]',
  pingFigure: "#home figure.ping",
  patelReal: '#home .name-patel:not([aria-hidden="true"])',
  patelDup: '#home .name-patel[aria-hidden="true"]',
  dots: "canvas[data-dots]",
  halftone: "[data-halftone]",
} as const;

// ── Evidence (review rounds read these; the lead copies them to .redesign/qa/round-N/) ──

/** Absolute path under test-results/ (the config's outputDir); creates the folder. */
export function evidencePath(info: TestInfo, ...parts: string[]): string {
  const file = path.join(info.project.outputDir, ...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

export function writeEvidence(info: TestInfo, relPath: string, data: unknown): string {
  const file = evidencePath(info, ...relPath.split("/"));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

/** Merge `data` under `key` into a JSON evidence file shared by several tests of one serial file. */
export function mergeEvidence(info: TestInfo, relPath: string, key: string, data: unknown): string {
  const file = evidencePath(info, ...relPath.split("/"));
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    /* first writer */
  }
  current[key] = data;
  fs.writeFileSync(file, JSON.stringify(current, null, 2));
  return file;
}

// ── Navigation and settling ───────────────────────────────────────────────

/** goto + fonts ready. Needs JavaScript (not for javaScriptEnabled:false specs). */
export async function gotoAndSettle(page: Page, url = "/") {
  const res = await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return res;
}

/** Wait for `rounds` idle callbacks (Safari has no rIC: short timeouts instead). */
export async function waitForIdle(page: Page, rounds = 2) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise<void>((resolve) => {
        if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 });
        else setTimeout(resolve, 250);
      });
    }
  }, rounds);
}

/** Wait until no new resource has finished loading for `quietMs` (lazy motion chunks, images). */
export async function waitForQuietNetwork(page: Page, quietMs = 500, timeoutMs = 10_000) {
  await page.evaluate(
    async ({ quietMs, timeoutMs }) => {
      // The default buffer stops at 250 entries, which would look like silence.
      performance.setResourceTimingBufferSize(2000);
      const start = performance.now();
      let count = performance.getEntriesByType("resource").length;
      let since = performance.now();
      while (performance.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 100));
        const now = performance.getEntriesByType("resource").length;
        if (now !== count) {
          count = now;
          since = performance.now();
        } else if (performance.now() - since >= quietMs) {
          return;
        }
      }
    },
    { quietMs, timeoutMs },
  );
}

/**
 * The app starts its motion controllers after `load` + idle (CONVENTIONS perf contract).
 * Call this before asserting on anything those controllers create.
 */
export async function settleApp(page: Page) {
  await waitForIdle(page);
  await waitForQuietNetwork(page);
  await waitForIdle(page, 1);
}

/** Wait for `n` animation frames. */
export async function frames(page: Page, n = 2) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

/** Wait until window.scrollY has not changed for `stableFrames` frames (Lenis, scrub, restore). */
export async function waitForScrollIdle(page: Page, stableFrames = 10, timeoutMs = 6000) {
  await page.evaluate(
    ({ stableFrames, timeoutMs }) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        let last = window.scrollY;
        let still = 0;
        const step = () => {
          const y = window.scrollY;
          still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
          last = y;
          if (still >= stableFrames || performance.now() - start > timeoutMs) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    { stableFrames, timeoutMs },
  );
}

/** Scroll to an absolute Y (works with Lenis: it adopts native scroll positions) and settle. */
export async function scrollToY(page: Page, y: number) {
  await waitForScrollIdle(page);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await waitForScrollIdle(page);
}

/** Wheel through the whole page in steps so lazy content mounts, then settle. */
export async function scrollThrough(page: Page, step = 600, pauseMs = 60) {
  for (let i = 0; i < 400; i++) {
    const atEnd = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
    );
    if (atEnd) break;
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(pauseMs);
  }
  await waitForScrollIdle(page);
}

/** Horizontal overflow in CSS px, and whether the page can actually be scrolled sideways. */
export async function horizontalScroll(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // The viewport's scrolling area (body clips overflow-x, so its own scrollWidth is not a scroll).
    const overflow = doc.scrollWidth - doc.clientWidth;
    const y = window.scrollY;
    window.scrollTo({ left: 200, top: y, behavior: "instant" });
    const scrolledX = window.scrollX;
    window.scrollTo({ left: 0, top: y, behavior: "instant" });
    return { overflow, scrolledX };
  });
}

/** Wait until a locator's box stops moving (scrubbed tweens catch up over ~1 s). */
export async function waitForStableBox(locator: Locator, timeoutMs = 4000) {
  let last = await locator.boundingBox();
  let still = 0;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await locator.page().waitForTimeout(80);
    const box = await locator.boundingBox();
    const same =
      !!box &&
      !!last &&
      Math.abs(box.x - last.x) < 0.25 &&
      Math.abs(box.y - last.y) < 0.25 &&
      Math.abs(box.width - last.width) < 0.25 &&
      Math.abs(box.height - last.height) < 0.25;
    still = same ? still + 1 : 0;
    last = box;
    if (still >= 4) return box;
  }
  return last;
}

/** Product of opacities from the element up to <html> (Playwright's toBeVisible ignores opacity). */
export async function effectiveOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity || 1);
    return o;
  });
}

/** Visible, non-zero size and effectively opaque (≥ .5). */
export async function isShown(locator: Locator): Promise<boolean> {
  const all = await locator.all();
  for (const el of all) {
    if ((await el.isVisible()) && (await effectiveOpacity(el)) >= 0.5) {
      const box = await el.boundingBox();
      if (box && box.width > 0 && box.height > 0) return true;
    }
  }
  return false;
}

// ── Hero and room geometry ─────────────────────────────────────────────────

/**
 * Scroll Y for a hero pin progress `p` (0..1). Reads the ScrollTrigger pin spacer when present
 * (distance = spacer height − hero height); falls back to the blueprint's +140vh pin.
 */
export async function heroProgressY(page: Page, p: number): Promise<number> {
  return page.evaluate((progress) => {
    const hero = document.getElementById("home");
    if (!hero) throw new Error("#home is missing");
    const spacer = hero.closest<HTMLElement>(".pin-spacer");
    const top = (spacer ?? hero).getBoundingClientRect().top + window.scrollY;
    const distance = spacer ? spacer.offsetHeight - hero.offsetHeight : 1.4 * window.innerHeight;
    return Math.round(top + progress * distance);
  }, p);
}

/**
 * Scroll Y that puts a projection-room chapter's midpoint at the viewport centre.
 * The chapter is `[data-chapter="<id>"]` (content/site.ts `chapters[].id`; requested from the
 * Phase 5 room owner, see sharedRequests). Until that hook exists it falls back to a heuristic:
 * the chapter heading (by `chapters[].title`) and its nearest ancestor inside #about that is at
 * least 80% of the viewport tall (chapters are min-height 90svh).
 */
export async function chapterMidY(page: Page, chapter: { id: string; title: string }): Promise<number> {
  return page.evaluate(({ id, title }) => {
    const room = document.getElementById("about");
    if (!room) throw new Error("#about is missing");
    let el = room.querySelector<HTMLElement>(`[data-chapter="${CSS.escape(id)}"]`);
    if (!el) {
      const heading = Array.from(room.querySelectorAll<HTMLElement>("h2, h3")).find(
        (h) => h.textContent?.trim() === title,
      );
      if (!heading) throw new Error(`no [data-chapter="${id}"] and no chapter heading "${title}" in #about`);
      el = heading;
      while (el.parentElement && el.parentElement !== room && el.offsetHeight < 0.8 * window.innerHeight) {
        el = el.parentElement;
      }
    }
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.round(r.top + window.scrollY + r.height / 2 - window.innerHeight / 2));
  }, { id: chapter.id, title: chapter.title });
}

// ── Keyboard ───────────────────────────────────────────────────────────────

const tabKeys = new WeakMap<Page, string>();

/**
 * Which key moves focus to links. Safari (and possibly Playwright's macOS WebKit) skips links on
 * plain Tab unless "Press Tab to highlight each item" is on; Option+Tab reaches them. Detected on a
 * scratch document, so call it BEFORE navigating to the page under test.
 */
export async function detectTabKey(page: Page): Promise<string> {
  const cached = tabKeys.get(page);
  if (cached) return cached;
  await page.setContent('<button id="qa-b">b</button><a id="qa-a" href="#qa-a">a</a>');
  let key = "Tab";
  for (const candidate of ["Tab", "Alt+Tab"]) {
    await page.focus("#qa-b");
    await page.keyboard.press(candidate);
    if (await page.evaluate(() => document.activeElement?.id === "qa-a")) {
      key = candidate;
      break;
    }
  }
  tabKeys.set(page, key);
  return key;
}

export type FocusInfo = {
  tag: string;
  label: string;
  inNav: boolean;
  inWork: boolean;
  hiddenFromAT: boolean;
  inClone: boolean;
  indexSlug: string | null;
  tileSlug: string | null;
  isBack: boolean;
  hasSize: boolean;
  ring: boolean;
};

export async function focusInfo(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el === document.documentElement) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
    const shadow = cs.boxShadow !== "none" && cs.boxShadow !== "";
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
      inNav: !!el.closest('header nav[aria-label="Primary"]'),
      inWork: !!el.closest("#work"),
      hiddenFromAT: !!el.closest('[aria-hidden="true"]'),
      inClone: !!el.closest("[data-clone]"),
      indexSlug: el.matches("ol#work-index a[data-index-link]") ? el.getAttribute("data-index-link") : null,
      tileSlug: el.matches("a[data-tile][data-canonical]") ? el.getAttribute("data-slug") : null,
      isBack: el.matches("a[data-back]"),
      hasSize: r.width > 0 && r.height > 0,
      ring: outline || shadow,
    };
  });
}

const describeFocus = (f: FocusInfo | null) => (f ? `${f.tag}"${f.label}"` : "(body)");

/**
 * Press `key` until `done` matches the focused element. Every stop on the way must be a real,
 * visible, announced control with a focus ring (never a clone or something aria-hidden).
 */
export async function tabUntil(
  page: Page,
  key: string,
  done: (f: FocusInfo) => boolean,
  max: number,
): Promise<{ found: FocusInfo; path: FocusInfo[] }> {
  const path: FocusInfo[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const f = await focusInfo(page);
    if (!f) continue;
    path.push(f);
    expect(f.hiddenFromAT, `focus reached an aria-hidden element: ${describeFocus(f)}`).toBe(false);
    expect(f.inClone, `focus reached a mosaic clone: ${describeFocus(f)}`).toBe(false);
    expect(f.hasSize, `focus reached an element with no size: ${describeFocus(f)}`).toBe(true);
    expect(f.ring, `no visible focus ring on ${describeFocus(f)}`).toBe(true);
    if (done(f)) return { found: f, path };
  }
  throw new Error(
    `target not reached after ${max} presses of ${key}; last stops: ${path.slice(-8).map(describeFocus).join(" → ")}`,
  );
}

// ── QA probes (window.__gaze / __dots / __perf / __st, NEXT_PUBLIC_QA=1 only) ─

export type ProbeName = "__gaze" | "__dots" | "__perf" | "__st";
export type Sample<T> = { t: number; v: T | null };

const PROBES: readonly ProbeName[] = ["__gaze", "__dots", "__perf", "__st"];

/** What exposes each probe in a NEXT_PUBLIC_QA=1 build (for failure messages). */
const PROBE_SOURCE: Record<ProbeName, string> = {
  __gaze: "components/hero/PingGaze (Phase 4)",
  __dots: "the components/dots stage (Phase 5)",
  __perf: "<PerfProbe /> (components/qa/PerfProbe) mounted once in app/layout.tsx",
  __st: "the QA-only `window.__st = ScrollTrigger` line in lib/scroll.ts startScroll()",
};

export async function hasProbe(page: Page, name: ProbeName): Promise<boolean> {
  return page.evaluate((n) => (window as unknown as Record<string, unknown>)[n] !== undefined, name);
}

/** The QA probes the page currently exposes. */
export async function presentProbes(page: Page): Promise<ProbeName[]> {
  return page.evaluate(
    (names) => names.filter((n) => (window as unknown as Record<string, unknown>)[n] !== undefined),
    [...PROBES],
  );
}

/**
 * Fail with a precise message when a probe is missing from a local run. A missing probe has two
 * causes: the server is not a NEXT_PUBLIC_QA=1 build, or the build is right and the code that
 * exposes the probe is not mounted. Any other probe being present proves the build is right.
 */
export async function expectProbe(page: Page, name: ProbeName, timeoutMs = 8000) {
  const found = await page
    .waitForFunction((n) => (window as unknown as Record<string, unknown>)[n] !== undefined, name, {
      timeout: timeoutMs,
      polling: 100,
    })
    .then(
      () => true,
      () => false,
    );
  if (found) return;
  const present = await presentProbes(page);
  const why = present.length
    ? `This is a QA build (${present.map((p) => `window.${p}`).join(", ")} present), so the missing piece is ${PROBE_SOURCE[name]}.`
    : `No QA probe is present at all: either the server is not a NEXT_PUBLIC_QA=1 build ` +
      `(NEXT_PUBLIC_QA=1 NEXT_DIST_DIR=.next-qa pnpm build), or ${PROBE_SOURCE[name]} is missing.`;
  expect(present, `window.${name} is missing after ${timeoutMs} ms. ${why}`).toContain(name);
}

export async function readProbe<T>(page: Page, name: ProbeName): Promise<T> {
  return page.evaluate(
    (n) => JSON.parse(JSON.stringify((window as unknown as Record<string, unknown>)[n] ?? null)),
    name,
  ) as Promise<T>;
}

/**
 * Record a probe every animation frame for `durationMs`, starting at the first `startOn` event
 * the page sees (so the clock starts when the input arrives, not when the test sent it).
 * Read the result with readProbeSamples.
 */
export async function startProbeSampler(
  page: Page,
  probe: Exclude<ProbeName, "__perf" | "__st">,
  opts: { startOn: "wheel" | "scroll" | "pointermove" | "touchstart" | "now"; durationMs: number },
) {
  await page.evaluate(
    ({ probe, startOn, durationMs }) => {
      const w = window as unknown as Record<string, unknown>;
      const state = { samples: [] as { t: number; v: unknown }[], done: false, started: false };
      w.__qaSampler = state;
      let t0 = -1;
      const begin = () => {
        if (t0 < 0) {
          t0 = performance.now();
          state.started = true;
        }
      };
      if (startOn === "now") begin();
      else window.addEventListener(startOn, begin, { capture: true, passive: true, once: true });
      const loop = () => {
        if (t0 >= 0) {
          const t = performance.now() - t0;
          const p = w[probe];
          state.samples.push({ t, v: p === undefined ? null : JSON.parse(JSON.stringify(p)) });
          if (t >= durationMs) {
            state.done = true;
            return;
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    { probe, startOn: opts.startOn, durationMs: opts.durationMs },
  );
}

export async function readProbeSamples<T>(page: Page, timeoutMs = 6000): Promise<Sample<T>[]> {
  await page.waitForFunction(
    () => (window as unknown as { __qaSampler?: { done: boolean } }).__qaSampler?.done === true,
    null,
    { timeout: timeoutMs },
  );
  return page.evaluate(
    () => (window as unknown as { __qaSampler: { samples: { t: number; v: unknown }[] } }).__qaSampler.samples,
  ) as Promise<Sample<T>[]>;
}

/** Time (ms) of the first sample matching `pred`, or Infinity. */
export function firstTime<T>(samples: Sample<T>[], pred: (v: T) => boolean): number {
  for (const s of samples) if (s.v !== null && pred(s.v)) return s.t;
  return Infinity;
}

// ── Maths ──────────────────────────────────────────────────────────────────

/** Screen-space angle from `a` to `b`: 0° = right, 90° = down (lib/gaze.ts convention). */
export const angleDeg = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 360;

/** Shortest arc between two angles, 0..180. */
export const angleDiff = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** Nearest-rank percentile of an unsorted list. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}
