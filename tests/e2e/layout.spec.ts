import { expect, test } from "@playwright/test";
import { chapters } from "../../content/site";
import {
  LAYOUT_WIDTHS,
  PROJECTS,
  SECTION_IDS,
  SEL,
  chapterMidY,
  evidencePath,
  gotoAndSettle,
  heightFor,
  horizontalScroll,
  isShown,
  scrollThrough,
  scrollToY,
  settleApp,
} from "./helpers";

// Blueprint §12 gate 5 (layout) and §3.1 layout gates. Runs on chromium and webkit.
// Screenshots are review evidence: test-results/screens/<project>-<width>.png.

/** Scrubbed tweens (`scrub: 1`) trail the scroll position by up to 1 s. */
const SCRUB_CATCH_UP_MS = 1100;

test.describe("layout", () => {
  for (const width of LAYOUT_WIDTHS) {
    test(`full-page screenshot at ${width}px`, async ({ page }, info) => {
      test.slow();
      await page.setViewportSize({ width, height: heightFor(width) });
      await gotoAndSettle(page, "/");
      await settleApp(page);
      // Mount lazy content (images, motion islands), then shoot from the top.
      await scrollThrough(page);
      await scrollToY(page, 0);
      await page.waitForTimeout(SCRUB_CATCH_UP_MS);

      for (const id of SECTION_IDS) {
        const box = await page.locator(`#${id}`).boundingBox();
        expect(box, `#${id} has no box at ${width}px`).not.toBeNull();
        expect(box!.width, `#${id} is wider than the ${width}px viewport`).toBeLessThanOrEqual(width + 1);
      }

      await page.screenshot({
        path: evidencePath(info, "screens", `${info.project.name}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    });
  }

  test("no horizontal scroll at 320px, top to bottom", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoAndSettle(page, "/");
    await settleApp(page);

    const top = await horizontalScroll(page);
    expect(top.overflow, "document is wider than 320px at the top").toBeLessThanOrEqual(0);
    expect(top.scrolledX).toBe(0);

    await scrollThrough(page);
    const bottom = await horizontalScroll(page);
    expect(bottom.overflow, "document is wider than 320px after scrolling").toBeLessThanOrEqual(0);
    expect(bottom.scrolledX).toBe(0);
  });

  test("below 360px the work section defaults to the list view", async ({ page }) => {
    // §6.1 / §6.5: list view is the default below 360 px.
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoAndSettle(page, "/");
    await settleApp(page);
    const list = page.locator(SEL.listView);
    await list.scrollIntoViewIfNeeded();
    await expect(list).toBeVisible();
    await expect(list.locator(":scope > li")).toHaveCount(PROJECTS.length);
  });

  test("touch layout at 390px @touch", async ({ page }, info) => {
    // mobile-chromium only (hover:none, pointer:coarse): the phone the visitor actually holds.
    await gotoAndSettle(page, "/");
    await settleApp(page);
    const h = await horizontalScroll(page);
    expect(h.overflow).toBeLessThanOrEqual(0);

    const button = page.locator(SEL.menuButton);
    await expect(button).toBeVisible();
    await button.tap();
    const menu = page.locator(SEL.menu);
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: evidencePath(info, "screens", `${info.project.name}-390-menu.png`) });
    await button.tap();
    await expect(menu).toBeHidden();

    await scrollThrough(page);
    await scrollToY(page, 0);
    await page.waitForTimeout(SCRUB_CATCH_UP_MS);
    await page.screenshot({
      path: evidencePath(info, "screens", `${info.project.name}-390.png`),
      fullPage: true,
      animations: "disabled",
    });
  });

  // unblock: Phase 5
  test.fixme("the projection room shows the dots canvas or the T0 halftones", async ({ page }) => {
    // §12: WebKit asserts that either the dots canvas or the halftones are visible (chromium too).
    await gotoAndSettle(page, "/");
    await settleApp(page);
    for (const ch of chapters) {
      await scrollToY(page, await chapterMidY(page, ch.title));
      await expect
        .poll(async () => (await isShown(page.locator(SEL.dots))) || (await isShown(page.locator(SEL.halftone))), {
          timeout: 5000,
          message: `neither canvas[data-dots] nor [data-halftone] is shown in chapter "${ch.title}"`,
        })
        .toBe(true);
    }
  });
});

// "Usable at 200% zoom" (§8 accessibility, CONVENTIONS a11y contract).
//
// Approach: browser zoom at 200% on a 1280×800 window halves the CSS viewport to 640×400 and
// doubles the device pixel ratio, so media queries and breakpoints respond exactly as they do for
// a zoomed visitor. That is what this emulates (viewport 640×400, deviceScaleFactor 2). CSS
// `zoom: 2` is NOT used: it scales rendering but leaves the 1280 px viewport and its breakpoints
// in place, which is not what a zoomed browser does, and it hides reflow bugs.
test.describe("200% zoom", () => {
  test.use({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });

  test("content reflows without horizontal scroll and the nav stays usable", async ({ page }, info) => {
    test.slow();
    await gotoAndSettle(page, "/");
    await settleApp(page);

    const vw = 640;
    const h = await horizontalScroll(page);
    expect(h.overflow, "horizontal overflow at 200% zoom").toBeLessThanOrEqual(0);

    // The fixed bar must not eat the short viewport.
    const header = await page.locator("header").first().boundingBox();
    expect(header, "no header").not.toBeNull();
    expect(header!.height).toBeLessThanOrEqual(400 * 0.3);

    // Below 768 px the links live in the popover menu; every link must be reachable and on-screen.
    const button = page.locator(SEL.menuButton);
    await expect(button).toBeVisible();
    await button.click();
    const menu = page.locator(SEL.menu);
    await expect(menu).toBeVisible();
    const links = menu.getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // Every heading is laid out inside the viewport (nothing clipped off the side).
    const headings = page.locator("h1, h2").filter({ visible: true });
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      const box = await heading.boundingBox();
      if (!box) continue;
      expect(box.x, `heading starts off-screen`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `heading runs past the viewport`).toBeLessThanOrEqual(vw + 1);
    }

    await scrollThrough(page);
    const after = await horizontalScroll(page);
    expect(after.overflow, "horizontal overflow at 200% zoom after scrolling").toBeLessThanOrEqual(0);

    await scrollToY(page, 0);
    await page.waitForTimeout(SCRUB_CATCH_UP_MS);
    await page.screenshot({
      path: evidencePath(info, "screens", `${info.project.name}-zoom200.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
});
