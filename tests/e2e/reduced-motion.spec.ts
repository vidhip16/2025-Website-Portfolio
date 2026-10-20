import { expect, test, type Page } from "@playwright/test";
import { chapters } from "../../content/site";
import {
  PROJECTS,
  SEL,
  chapterMidY,
  expectProbe,
  gotoAndSettle,
  isShown,
  readProbeSamples,
  scrollThrough,
  scrollToY,
  settleApp,
  skipUnlessQaBuild,
  startProbeSampler,
  angleDiff,
  firstTime,
} from "./helpers";
import type { GazeProbe } from "../../lib/gaze";

// Blueprint §12 gate 5 reduced-motion run: no ScrollTriggers created, mosaic paused, halftones shown.
// Runs on chromium and webkit.
//
// "No ScrollTriggers" is checked in two layers:
//   1. Engine-agnostic DOM traces, on every run (local and remote): no `.pin-spacer` (pinned
//      triggers) and no inline transform on any mosaic column (scrubbed parallax triggers).
//   2. The live count from window.__st, hard on local QA builds: the probe must exist there, so a
//      trigger that leaves no DOM trace cannot pass silently. lib/scroll.ts exposes it (sharedRequest).

test.use({ reducedMotion: "reduce" });

/** Load the home page with motion off and give every lazy motion controller a chance to start. */
async function loadAndScrollThrough(page: Page) {
  await gotoAndSettle(page, "/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await settleApp(page);
  await scrollThrough(page);
  await settleApp(page);
}

/**
 * Live ScrollTriggers from `window.__st`: a number, an array, or anything with getAll()
 * (ScrollTrigger itself). Null when the probe is missing or has none of those shapes.
 */
async function liveScrollTriggers(page: Page): Promise<{ count: number; triggers: string[] } | null> {
  return page.evaluate(() => {
    const st = (window as unknown as { __st?: unknown }).__st;
    if (st === undefined || st === null) return null;
    if (typeof st === "number") return { count: st, triggers: [] };
    const getAll = (st as { getAll?: () => unknown[] }).getAll;
    const list = Array.isArray(st) ? st : typeof getAll === "function" ? getAll.call(st) : null;
    if (!list) return null;
    const describe = (t: unknown) => {
      const { trigger, vars } = t as { trigger?: Element; vars?: { id?: string; pin?: unknown; scrub?: unknown } };
      const el = trigger
        ? `${trigger.tagName.toLowerCase()}${trigger.id ? `#${trigger.id}` : ""}`
        : "(no trigger element)";
      return [el, vars?.pin ? "pin" : "", vars?.scrub ? "scrub" : "", vars?.id ? `id=${vars.id}` : ""]
        .filter(Boolean)
        .join(" ");
    };
    return { count: list.length, triggers: list.map(describe) };
  });
}

test.describe("reduced motion", () => {
  test("motion is off: no pins, no scrubbed mosaic columns, no smooth scroll", async ({ page }, info) => {
    test.slow();
    await loadAndScrollThrough(page);

    // A pinned ScrollTrigger wraps its element in .pin-spacer.
    await expect(page.locator(".pin-spacer")).toHaveCount(0);

    // A scrubbed parallax trigger (components/work/mosaicMotion setParallax → gsap.fromTo(col, …,
    // {scrollTrigger: {scrub: true}})) writes an inline transform on its [data-mosaic-col] as soon
    // as it is created: fromTo renders its start state at once. The columns' own inline style is
    // only the --off custom property, so any inline transform means a trigger was created.
    const cols = page.locator(SEL.mosaicCol);
    info.annotations.push({ type: "mosaic columns checked", description: String(await cols.count()) });
    await expect
      .poll(
        () =>
          cols.evaluateAll((els) =>
            els.flatMap((el) => {
              const t = (el as HTMLElement).style.transform;
              return t && t !== "none" ? [`column ${el.getAttribute("data-mosaic-col")}: ${t}`] : [];
            }),
          ),
        { message: "mosaic columns carry a scrubbed (ScrollTrigger) transform under reduced motion" },
      )
      .toEqual([]);

    // Smooth scrolling stays off: Lenis is not created when ambient motion is off.
    await expect(page.locator("html")).not.toHaveClass(/\blenis-smooth\b/);
  });

  test("window.__st reports zero live ScrollTriggers", async ({ page, baseURL }) => {
    // Remote builds have no QA probes. On a local QA build the probe is required, never skipped.
    skipUnlessQaBuild(baseURL);
    test.slow();
    await loadAndScrollThrough(page);
    await expectProbe(page, "__st");
    const live = await liveScrollTriggers(page);
    expect(live, "window.__st is not a count, an array or an object with getAll()").not.toBeNull();
    expect(live!.triggers, `${live!.count} live ScrollTrigger(s) under reduced motion`).toEqual([]);
    expect(live!.count, "live ScrollTriggers under reduced motion").toBe(0);
  });

  test("the mosaic is still: list view by default, or every track at rate 0", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await page.locator("#work").scrollIntoViewIfNeeded();
    await settleApp(page);

    const list = page.locator(SEL.listView);
    if (await list.isVisible()) {
      // §6.5: View as list is the default under reduced motion.
      await expect(list.locator(":scope > li")).toHaveCount(PROJECTS.length);
      return;
    }

    const tracks = page.locator(SEL.track);
    expect(await tracks.count(), "neither the list view nor mosaic tracks are shown").toBeGreaterThan(0);
    const anims = await tracks.evaluateAll((els) =>
      els.flatMap((el) => el.getAnimations().map((a) => ({ rate: a.playbackRate, state: a.playState }))),
    );
    for (const a of anims) {
      expect(a.rate === 0 || a.state !== "running", `track animation running at rate ${a.rate}`).toBe(true);
    }
    const tops = () => tracks.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    const before = await tops();
    await page.waitForTimeout(600);
    const after = await tops();
    before.forEach((t, i) => expect(Math.abs(t - after[i]), `track ${i} moved`).toBeLessThanOrEqual(0.5));
  });

  // unblocked: Phase 5
  test("the projection room shows static halftones, not the dots canvas", async ({ page }) => {
    // §5.6: reduced motion → a static halftone per chapter, hard cuts, no morphs.
    await gotoAndSettle(page, "/");
    await settleApp(page);
    for (const ch of chapters) {
      await scrollToY(page, await chapterMidY(page, ch));
      await expect
        .poll(() => isShown(page.locator(SEL.halftone)), { message: `no halftone in "${ch.title}"` })
        .toBe(true);
      expect(await isShown(page.locator(SEL.dots)), `dots canvas shown in "${ch.title}"`).toBe(false);
    }
  });

  // unblocked: Phase 4
  test("the gaze still follows the pointer, snapping", async ({ page, baseURL }) => {
    // §4.5: user-driven gaze keeps working under reduced motion, with no easing.
    skipUnlessQaBuild(baseURL);
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expectProbe(page, "__gaze");
    const box = await page.locator(SEL.pingFigure).boundingBox();
    expect(box).not.toBeNull();
    const eyes = { x: box!.x + box!.width / 2, y: box!.y + box!.height * 0.3 };
    await page.mouse.move(eyes.x - 400, eyes.y);
    await page.waitForTimeout(300);

    await startProbeSampler(page, "__gaze", { startOn: "pointermove", durationMs: 300 });
    await page.mouse.move(eyes.x + 400, eyes.y); // to the right: aim ≈ 0°
    const samples = await readProbeSamples<GazeProbe>(page);
    const t = firstTime(samples, (g) => g.aim !== null && angleDiff(g.aim, 0) <= 15);
    expect(t, "gaze did not snap to the pointer within 100 ms").toBeLessThanOrEqual(100);
  });
});
