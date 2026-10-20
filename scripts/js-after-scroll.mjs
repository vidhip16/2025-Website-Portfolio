// Measure the JavaScript a visitor downloads on "/" after a full scroll
// (blueprint §8: "All JavaScript after a full scroll ≤ 360 KB gz").
// Needs a running server:  node scripts/js-after-scroll.mjs [baseURL]
// Writes test-results/js-after-scroll.json; exits 1 over budget.
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:3300";
const BUDGET = 360 * 1024;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const seen = new Map();
page.on("response", async (r) => {
  const u = r.url();
  if (!u.endsWith(".js") || seen.has(u)) return;
  try {
    seen.set(u, zlib.gzipSync(await r.body(), { level: 9 }).length);
  } catch {
    /* aborted or redirected */
  }
});
await page.goto(base + "/", { waitUntil: "load" });
await page.waitForTimeout(2500);
const h = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < h; y += 500) {
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(3000);
await browser.close();
const total = [...seen.values()].reduce((a, b) => a + b, 0);
const out = { total, budget: BUDGET, ok: total <= BUDGET, scripts: Object.fromEntries([...seen].map(([u, s]) => [u.split("/").pop(), s])) };
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync("test-results/js-after-scroll.json", JSON.stringify(out, null, 2));
console.log(`${out.ok ? "ok      " : "FAIL    "} JS after full scroll (gz)   ${(total / 1024).toFixed(1)} KB / ${(BUDGET / 1024).toFixed(1)} KB  (${seen.size} scripts)`);
process.exit(out.ok ? 0 : 1);
