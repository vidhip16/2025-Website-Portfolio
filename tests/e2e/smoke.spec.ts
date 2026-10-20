import { expect, test } from "@playwright/test";
import { notFound } from "../../content/site";
import { PROJECTS, SECTION_IDS, SEL, detectTabKey } from "./helpers";

test.describe("smoke", () => {
  test("home renders every section and one h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    for (const id of SECTION_IDS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator("#projects")).toHaveCount(1);
    await expect(page.locator("#resume")).toHaveCount(1);
  });

  test("skip link is the first focusable element", async ({ page }) => {
    const tab = await detectTabKey(page);
    await page.goto("/");
    await page.keyboard.press(tab);
    await expect(page.locator(":focus")).toHaveText(/skip to content/i);
  });

  test("every project has a detail page with its title, repo and back link", async ({ page }) => {
    for (const p of PROJECTS) {
      const res = await page.goto(`/work/${p.slug}`);
      expect(res?.status(), p.slug).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(p.title);
      await expect(page.locator(SEL.detailHero)).toBeVisible();
      await expect(page.locator(SEL.repo)).toHaveAttribute("href", p.repo);
      await expect(page.locator(SEL.back)).toHaveText(/back to the gallery/i);
    }
  });

  test("detail pages link to their neighbours", async ({ page }) => {
    for (const p of PROJECTS) {
      await page.goto(`/work/${p.slug}`);
      const prev = page.locator('a[rel="prev"]');
      const next = page.locator('a[rel="next"]');
      expect((await prev.count()) + (await next.count()), `${p.slug} has no prev/next links`).toBeGreaterThan(0);
      for (const link of [...(await prev.all()), ...(await next.all())]) {
        await expect(link).toHaveAttribute("href", /^\/work\/[a-z0-9-]+$/);
      }
    }
  });

  test("unknown routes return 404 with the gallery copy", async ({ page }) => {
    const res = await page.goto("/this-page-is-not-on-the-wall");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: notFound.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: notFound.back })).toHaveAttribute("href", /^\/(#.*)?$/);
  });
});
