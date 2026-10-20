import { defineConfig, devices } from "@playwright/test";

// Local runs start `next start` on a QA build (NEXT_PUBLIC_QA=1 → window.__gaze/__dots).
// Build it first:  NEXT_PUBLIC_QA=1 NEXT_DIST_DIR=.next-qa pnpm build
// Remote runs:     BASE_URL=https://… pnpm test:e2e --grep-invert @form
const PORT = Number(process.env.PORT || 3100);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: BASE_URL,
    // Remote previews may inject the Vercel toolbar; locally send nothing extra.
    extraHTTPHeaders: isLocal ? {} : { "x-vercel-skip-toolbar": "1" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: "chromium",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: isLocal
    ? {
        command: `pnpm start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-qa",
          CONTACT_MODE: "mock",
        },
      }
    : undefined,
});
