import { expect, test, type Page } from "@playwright/test";
import {
  PROJECTS,
  SEL,
  detectTabKey,
  focusInfo,
  gotoAndSettle,
  settleApp,
  tabUntil,
  waitForScrollIdle,
} from "./helpers";

// Blueprint §12 gate 5 keyboard path and §6.5 accessible fallback. Active now (Phase 3 lands the
// shell, mosaic, index and detail pages). Runs on chromium and webkit at 1280×800.

const pathname = (page: Page) => new URL(page.url()).pathname.replace(/\/$/, "") || "/";
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

test.describe("keyboard path", () => {
  test("the skip link is the first stop and moves focus to main", async ({ page }) => {
    const tab = await detectTabKey(page);
    await gotoAndSettle(page, "/");
    await page.keyboard.press(tab);
    await expect(page.locator(":focus")).toHaveText(/skip to content/i);
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("skip link → nav → index → canonical tile → detail → back restores scroll", async ({ page }) => {
    test.slow();
    const tab = await detectTabKey(page);
    await gotoAndSettle(page, "/");
    await settleApp(page);

    // 1. Skip link first.
    await page.keyboard.press(tab);
    await expect(page.locator(":focus")).toHaveText(/skip to content/i);

    // 2. Then the primary nav.
    const nav = await tabUntil(page, tab, (f) => f.inNav, 3);
    expect(nav.path.at(-1)?.inNav).toBe(true);

    // 3. On to the work index. Every stop on the way is visible, announced and ringed (tabUntil).
    const toIndex = await tabUntil(page, tab, (f) => !!f.indexSlug, 160);
    const indexOrder = [toIndex.found.indexSlug!];
    for (let i = 1; i < PROJECTS.length; i++) {
      await page.keyboard.press(tab);
      const f = await focusInfo(page);
      expect(f?.indexSlug, `index stop ${i + 1} is not an index link (${f?.label})`).toBeTruthy();
      indexOrder.push(f!.indexSlug!);
    }
    expect([...indexOrder].sort()).toEqual(PROJECTS.map((p) => p.slug).sort());

    // 4. The index is followed by the canonical tiles; nothing outside #work in between.
    const toTile = await tabUntil(page, tab, (f) => !!f.tileSlug, 12);
    for (const stop of toTile.path) expect(stop.inWork, `left #work before the tiles at "${stop.label}"`).toBe(true);
    const slug = toTile.found.tileSlug!;
    const title = PROJECTS.find((p) => p.slug === slug)!.title;

    await waitForScrollIdle(page);
    const before = await scrollY(page);
    expect(before, "the tile should be scrolled into view below the hero").toBeGreaterThan(0);

    // 5. Enter opens the detail page.
    await page.keyboard.press("Enter");
    await expect.poll(() => pathname(page)).toBe(`/work/${slug}`);
    await expect(page.locator(SEL.detailHero)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);

    // 6. "Back to the gallery" by keyboard restores the gallery scroll position (within 50 px).
    const back = await tabUntil(page, tab, (f) => f.isBack, 80);
    expect(back.found.label).toMatch(/back to the gallery/i);
    await page.keyboard.press("Enter");
    await expect.poll(() => pathname(page)).toBe("/");
    await expect
      .poll(async () => Math.abs((await scrollY(page)) - before), {
        timeout: 6000,
        message: `scroll was ${before}px before opening ${slug}`,
      })
      .toBeLessThanOrEqual(50);
  });

  test("back to the gallery after a reload on the detail page keeps #work where it was", async ({ page }) => {
    // The reload is a new document: `/` then mounts with no hero controller loaded, so Work
    // restores the position into a page that has no pin yet (the pin is added a moment later).
    test.slow();
    await gotoAndSettle(page, "/");
    await settleApp(page);

    const workTop = () => page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top);
    const link = page.locator(SEL.indexLink).first();
    await link.scrollIntoViewIfNeeded();
    await waitForScrollIdle(page);
    const slug = await link.getAttribute("data-index-link");
    const before = await workTop();
    expect(await scrollY(page), "the index should be below the hero").toBeGreaterThan(0);

    await link.click();
    await expect.poll(() => pathname(page)).toBe(`/work/${slug}`);
    await expect(page.locator(SEL.detailHero)).toBeVisible();

    await page.reload();
    await settleApp(page);
    await expect(page.locator(SEL.detailHero)).toBeVisible();

    await page.locator(SEL.back).click();
    await expect.poll(() => pathname(page)).toBe("/");
    await settleApp(page);
    await expect
      .poll(
        async () => {
          await waitForScrollIdle(page);
          return Math.abs((await workTop()) - before);
        },
        { timeout: 10_000, message: `#work's top was ${before}px before opening ${slug}` },
      )
      .toBeLessThanOrEqual(50);
  });

  test("mosaic clones stay out of the tab order and the accessibility tree", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);

    const groups = page.locator(SEL.cloneGroup);
    const n = await groups.count();
    expect(n, "no [data-clone] groups in the mosaic").toBeGreaterThan(0);
    await expect(page.locator(`${SEL.cloneGroup}[aria-hidden="true"]`)).toHaveCount(n);

    const focusable = await groups.evaluateAll((els) =>
      els.flatMap((g) =>
        Array.from(g.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
          .filter((el) => el.getAttribute("tabindex") !== "-1")
          .map((el) => el.outerHTML.slice(0, 120)),
      ),
    );
    expect(focusable, "focusable elements inside clones").toEqual([]);

    // Never `inert` (it blocks pointer hit-testing on the visible half of every loop).
    await expect(page.locator(`${SEL.mosaic} [inert]`)).toHaveCount(0);

    // Exactly one canonical tile per project, never inside a clone.
    for (const p of PROJECTS) {
      const tile = page.locator(`${SEL.canonicalTile}[data-slug="${p.slug}"]`);
      await expect(tile, `canonical tile for ${p.slug}`).toHaveCount(1);
      expect(await tile.evaluate((el) => !!el.closest("[data-clone]"))).toBe(false);
    }
  });
});

test.describe("accessible fallback (§6.5)", () => {
  test("View as list switches to six cards and is remembered", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);

    const toggle = page.locator(SEL.viewToggle).first();
    const list = page.locator(SEL.listView);
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(list).toBeVisible();
    await expect(list.locator(":scope > li")).toHaveCount(PROJECTS.length);
    for (const p of PROJECTS) {
      await expect(list.locator(`a[href="/work/${p.slug}"]`).first(), `list card link for ${p.slug}`).toBeVisible();
    }

    await page.reload();
    await settleApp(page);
    await expect(page.locator(SEL.viewToggle).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(SEL.listView)).toBeVisible();

    await page.locator(SEL.viewToggle).first().focus();
    await page.keyboard.press("Space");
    await expect(page.locator(SEL.viewToggle).first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(SEL.mosaic)).toBeVisible();
  });

  test("Pause motion stops the mosaic and is remembered (WCAG 2.2.2)", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await page.locator("#work").scrollIntoViewIfNeeded();

    const toggles = page.locator(SEL.motionToggle);
    await expect(toggles.first()).toHaveAttribute("aria-pressed", "false");
    await toggles.first().focus();
    await page.keyboard.press("Enter");
    for (const t of await toggles.all()) await expect(t).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

    // Rates ease to 0 (never pause()/cancel()); give the ease a moment, then nothing moves.
    await page.waitForTimeout(1200);
    const rates = await page
      .locator(SEL.track)
      .evaluateAll((els) => els.flatMap((el) => el.getAnimations().map((a) => ({ rate: a.playbackRate, state: a.playState }))));
    for (const r of rates) expect(Math.abs(r.rate) <= 0.02 || r.state !== "running", `track still at rate ${r.rate}`).toBe(true);
    const tops = () =>
      page.locator(SEL.track).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    const a = await tops();
    await page.waitForTimeout(500);
    const b = await tops();
    a.forEach((top, i) => expect(Math.abs(top - b[i]), `track ${i} moved while paused`).toBeLessThanOrEqual(0.5));

    await page.reload();
    await settleApp(page);
    await expect(page.locator(SEL.motionToggle).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  });
});
