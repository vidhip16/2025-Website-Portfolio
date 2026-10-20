import { test, type Page } from "@playwright/test";

/** True when the run targets a local server (form specs may submit). */
export const isLocalBase = (baseURL?: string) =>
  !!baseURL && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

/** Call inside every @form spec: skip unless the base URL is local. */
export function skipUnlessLocal(baseURL?: string) {
  test.skip(!isLocalBase(baseURL), "@form specs only run against a local server");
}

/** Scroll the whole page in steps so lazy content mounts. */
export async function scrollThrough(page: Page, step = 600) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(60);
  }
}
