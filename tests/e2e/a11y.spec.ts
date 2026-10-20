import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const ROUTES = ["/", "/work/type-racer", "/this-page-does-not-exist"];

test.describe("axe", () => {
  for (const route of ROUTES) {
    test(`no serious/critical issues on ${route}`, async ({ page }, info) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      const out = info.outputPath(`axe-${route.replace(/\W+/g, "_")}.json`);
      fs.writeFileSync(out, JSON.stringify(results.violations, null, 2));
      expect(bad.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
    });
  }
});
