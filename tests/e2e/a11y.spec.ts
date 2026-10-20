import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { chapters } from "../../content/site";
import { PROJECTS, SEL, chapterMidY, gotoAndSettle, scrollToY, settleApp, writeEvidence } from "./helpers";

// Blueprint §12 gate 6: zero serious or critical axe issues on /, every /work/<slug> and the 404.
// Evidence: test-results/axe/<project>-<route>.json (all violations, any impact).

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const ROUTES: { name: string; path: string; status: number }[] = [
  { name: "home", path: "/", status: 200 },
  ...PROJECTS.map((p) => ({ name: `work-${p.slug}`, path: `/work/${p.slug}`, status: 200 })),
  { name: "404", path: "/this-page-is-not-on-the-wall", status: 404 },
];

async function audit(page: Page, info: TestInfo, name: string, url: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  writeEvidence(info, `axe/${info.project.name}-${name}.json`, {
    url,
    include: include ?? null,
    violations: results.violations,
    incomplete: results.incomplete.map((r) => ({ id: r.id, impact: r.impact, nodes: r.nodes.length })),
    passes: results.passes.length,
  });
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes, e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test.describe("axe", () => {
  for (const route of ROUTES) {
    test(`no serious or critical issues on ${route.path}`, async ({ page }, info) => {
      const res = await gotoAndSettle(page, route.path);
      expect(res?.status(), `${route.path} status`).toBe(route.status);
      await settleApp(page);
      await audit(page, info, route.name, route.path);
    });
  }

  test("no serious or critical issues in the projection room (night)", async ({ page }, info) => {
    // The room tweens the page to night; contrast has to hold there too (moon on night).
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await scrollToY(page, await chapterMidY(page, chapters[1]));
    await page.waitForTimeout(1100); // scrub: 1
    await audit(page, info, "home-room", "/#about", "#about");
  });

  test("no serious or critical issues with the mobile menu open", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await page.locator(SEL.menuButton).click();
    await expect(page.locator(SEL.menu)).toBeVisible();
    await audit(page, info, "home-menu", "/ (menu open)", "header");
  });
});
