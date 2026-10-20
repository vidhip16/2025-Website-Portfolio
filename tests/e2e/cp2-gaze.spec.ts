import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import gaze from "../../content/gaze.json";
import { gotoAndSettle, skipUnlessQaBuild } from "./helpers";

// CP2 evidence (blueprint §10): Ping's gaze with the pointer at the eight compass
// points and the centre, plus a 5 s video of wheel-scrolling over Ping.
// Run on its own:  pnpm exec playwright test --project=chromium --grep @cp2
// Output: test-results/cp2/{pointer-*.png, sheet order}, test-results/cp2/video/*.webm

const OUT = path.join("test-results", "cp2");
const DIRS = [
  ["N", 0, -1], ["NE", 1, -1], ["E", 1, 0], ["SE", 1, 1],
  ["S", 0, 1], ["SW", -1, 1], ["W", -1, 0], ["NW", -1, -1], ["centre", 0, 0],
] as const;

test.describe("CP2 gaze evidence @cp2", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "evidence is captured once, in Chromium");

  test("pointer at N, NE, E, SE, S, SW, W, NW and centre", async ({ page, baseURL }) => {
    skipUnlessQaBuild(baseURL);
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/");
    await page.waitForFunction(() => !!window.__gaze, null, { timeout: 15_000 });
    const box = await page.locator("#home figure.ping").boundingBox();
    expect(box).toBeTruthy();
    const mid = { x: box!.x + (gaze.eyeMid[0] / 100) * box!.width, y: box!.y + (gaze.eyeMid[1] / 100) * box!.height };
    const R = 320;
    const results: Record<string, unknown> = {};
    for (const [name, dx, dy] of DIRS) {
      const len = Math.hypot(dx, dy) || 1;
      await page.mouse.move(mid.x + (dx / len) * R, mid.y + (dy / len) * R, { steps: 8 });
      await page.waitForTimeout(700);
      results[name] = await page.evaluate(() => window.__gaze);
      await page.screenshot({
        path: path.join(OUT, `pointer-${name}.png`),
        clip: { x: Math.max(0, box!.x - 40), y: Math.max(0, box!.y - 20), width: box!.width + 80, height: box!.height * 0.62 },
      });
    }
    fs.writeFileSync(path.join(OUT, "pointer-probes.json"), JSON.stringify({ mid, results }, null, 2));
    // E should aim near 0°, S near 90°, W near 180°, N near 270°; centre is the dead zone.
    const aim = (k: string) => (results[k] as { aim: number | null }).aim;
    expect(aim("centre")).toBeNull();
    for (const [k, want] of [["E", 0], ["S", 90], ["W", 180], ["N", 270]] as const) {
      const a = aim(k);
      expect(a, k).not.toBeNull();
      const d = Math.abs((((a! - want) % 360) + 540) % 360 - 180);
      expect(d, `${k} aim ${a}`).toBeLessThan(15);
    }
  });

  test("5 s of wheel-scrolling over Ping (video)", async ({ browser, baseURL }) => {
    skipUnlessQaBuild(baseURL);
    const dir = path.join(OUT, "video");
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, "/");
    await page.waitForFunction(() => !!window.__gaze, null, { timeout: 15_000 });
    const box = await page.locator("#home figure.ping").boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.45);
    const t0 = Date.now();
    let dir1 = 1;
    while (Date.now() - t0 < 5000) {
      await page.mouse.wheel(0, 90 * dir1);
      await page.waitForTimeout(120);
      if ((Date.now() - t0) % 1600 < 130) dir1 = -dir1;
    }
    await page.waitForTimeout(600);
    await ctx.close();
  });
});
