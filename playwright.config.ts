import { defineConfig, devices } from "@playwright/test";

// QA harness (blueprint §12 gates 5–7). Local runs start `next start` on a QA build
// (NEXT_PUBLIC_QA=1 → window.__gaze / __dots / __perf). Build it first:
//   NEXT_PUBLIC_QA=1 NEXT_DIST_DIR=.next-qa pnpm build
//
// Projects
//   chromium         every e2e spec at 1280×800 (gate 5 and the axe gate 6); @touch specs excluded
//   webkit           layout, keyboard, no-JS, reduced-motion and no-WebGL only (§12 gate 5)
//   mobile-chromium  @touch specs only: touch emulation at 390 px (hover:none, pointer:coarse)
//   perf             tests/perf (gate 7): Chromium, one worker; run it alone, with no workflow
//                    active and no dev server, never as part of a gate-5 run
//   unit             tests/unit, no browser
//
// Gate 5/6:  pnpm exec playwright test --project=chromium --project=webkit --project=mobile-chromium
// Gate 7:    pnpm exec playwright test --project=perf
// Remote:    BASE_URL=https://… pnpm exec playwright test --project=chromium --project=webkit --grep-invert @form
//            (RULES Hard rule 6: never submit the form against a remote URL; @form specs also skip themselves.)
//
// Evidence (review rounds copy these to .redesign/qa/round-N/): test-results/screens/*.png,
// test-results/axe/*.json, test-results/hero/*.json, test-results/perf/frame-time.json.
const PORT = Number(process.env.PORT || 3100);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);

const DESKTOP = { width: 1280, height: 800 };
const E2E = /e2e\/.*\.spec\.ts$/;
const WEBKIT_SPECS = /e2e\/(layout|keyboard|nojs|reduced-motion|no-webgl)\.spec\.ts$/;
const TOUCH = /@touch/;

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
    { name: "unit", testMatch: /unit\/.*\.spec\.ts$/ },
    {
      name: "chromium",
      testMatch: E2E,
      grepInvert: TOUCH,
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP },
    },
    {
      name: "webkit",
      testMatch: WEBKIT_SPECS,
      grepInvert: TOUCH,
      use: { ...devices["Desktop Safari"], viewport: DESKTOP },
    },
    {
      name: "mobile-chromium",
      testMatch: E2E,
      grep: TOUCH,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "perf",
      testMatch: /perf\/.*\.spec\.ts$/,
      workers: 1,
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP },
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
          // Fail-closed contact action: mock locally, whatever else is set (blueprint §7).
          CONTACT_MODE: "mock",
        },
      }
    : undefined,
});
