import { expect, test } from "@playwright/test";
import { chapters } from "../../content/site";
import type { DotsProbe } from "../../lib/gaze";
import {
  SEL,
  chapterMidY,
  gotoAndSettle,
  hasProbe,
  isShown,
  readProbe,
  scrollThrough,
  scrollToY,
  settleApp,
} from "./helpers";

// Blueprint §12 gate 5 / §5.6: no WebGL → T0 halftones. Simulated with an init script that makes
// getContext('webgl' | 'webgl2' | 'experimental-webgl') return null, which works in both engines.

/** Runs in the page before any of its scripts (serialised by Playwright: keep it self-contained). */
function blockWebGL() {
  const blocked = new Set(["webgl", "webgl2", "experimental-webgl"]);
  type GetContext = (this: unknown, type: string, ...rest: unknown[]) => unknown;
  const patch = (proto: { getContext: GetContext } | undefined) => {
    if (!proto) return;
    const original = proto.getContext;
    proto.getContext = function (this: unknown, type: string, ...rest: unknown[]) {
      return blocked.has(type) ? null : original.call(this, type, ...rest);
    };
  };
  patch(HTMLCanvasElement.prototype as unknown as { getContext: GetContext });
  if (typeof OffscreenCanvas !== "undefined") {
    patch(OffscreenCanvas.prototype as unknown as { getContext: GetContext });
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(blockWebGL);
});

test.describe("no WebGL", () => {
  test("the simulation works and the page loads and scrolls without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await gotoAndSettle(page, "/");
    const ctx = await page.evaluate(() => ({
      webgl2: document.createElement("canvas").getContext("webgl2") === null,
      webgl: document.createElement("canvas").getContext("webgl") === null,
      twoD: document.createElement("canvas").getContext("2d") !== null,
    }));
    expect(ctx).toEqual({ webgl2: true, webgl: true, twoD: true });

    await settleApp(page);
    await scrollThrough(page);
    await settleApp(page);
    expect(errors, "uncaught errors with WebGL unavailable").toEqual([]);
  });

  // unblock: Phase 5
  test.fixme("the projection room falls back to T0 halftones", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    for (const ch of chapters) {
      await scrollToY(page, await chapterMidY(page, ch));
      await expect
        .poll(() => isShown(page.locator(SEL.halftone)), { message: `no halftone in "${ch.title}"` })
        .toBe(true);
      expect(await isShown(page.locator(SEL.dots)), "a dots canvas is shown without WebGL").toBe(false);
    }
    if (await hasProbe(page, "__dots")) {
      expect((await readProbe<DotsProbe>(page, "__dots")).tier).toBe("T0");
    }
  });
});
