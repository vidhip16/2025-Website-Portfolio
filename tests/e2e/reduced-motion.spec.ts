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

test.use({ reducedMotion: "reduce" });

/**
 * Live ScrollTrigger count when the app exposes `window.__st` (QA builds; see sharedRequests),
 * else null. Accepts a number, an array, or anything with getAll().
 */
async function scrollTriggerCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const st = (window as unknown as { __st?: unknown }).__st;
    if (st === undefined || st === null) return null;
    if (typeof st === "number") return st;
    if (Array.isArray(st)) return st.length;
    const getAll = (st as { getAll?: () => unknown[] }).getAll;
    return typeof getAll === "function" ? getAll.call(st).length : null;
  });
}

test.describe("reduced motion", () => {
  test("motion is off and no ScrollTriggers or pins are created", async ({ page }) => {
    test.slow();
    await gotoAndSettle(page, "/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

    // Give the lazy motion controllers every chance to start, across the whole page.
    await settleApp(page);
    await scrollThrough(page);
    await settleApp(page);

    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    const st = await scrollTriggerCount(page);
    if (st !== null) expect(st, "window.__st reports live ScrollTriggers").toBe(0);
    // Smooth scrolling stays off: Lenis is not created when ambient motion is off.
    await expect(page.locator("html")).not.toHaveClass(/\blenis-smooth\b/);
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

  // unblock: Phase 5
  test.fixme("the projection room shows static halftones, not the dots canvas", async ({ page }) => {
    // §5.6: reduced motion → a static halftone per chapter, hard cuts, no morphs.
    await gotoAndSettle(page, "/");
    await settleApp(page);
    for (const ch of chapters) {
      await scrollToY(page, await chapterMidY(page, ch.title));
      await expect
        .poll(() => isShown(page.locator(SEL.halftone)), { message: `no halftone in "${ch.title}"` })
        .toBe(true);
      expect(await isShown(page.locator(SEL.dots)), `dots canvas shown in "${ch.title}"`).toBe(false);
    }
  });

  // unblock: Phase 4
  test.fixme("the gaze still follows the pointer, snapping", async ({ page, baseURL }) => {
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
