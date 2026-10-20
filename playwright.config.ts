import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// QA harness (blueprint §12 gates 5–7). Local runs start `next start` on a QA build
// (NEXT_PUBLIC_QA=1 → window.__gaze / __dots / __perf / __st). Build it first:
//   NEXT_PUBLIC_QA=1 NEXT_DIST_DIR=.next-qa pnpm build
//
// Projects in a default run
//   chromium         every e2e spec at 1280×800 (gate 5 and the axe gate 6); @touch specs excluded
//   webkit           layout, keyboard, no-JS, reduced-motion and no-WebGL only (§12 gate 5)
//   mobile-chromium  @touch specs only: touch emulation at 390 px (hover:none, pointer:coarse)
//   unit             tests/unit, no browser
// Projects in a perf run (PW_PERF=1 only)
//   perf             tests/perf (gate 7): Chromium, one worker, and the ONLY project registered.
//                    §12: frame times taken while other browsers, agents or a dev server compete
//                    for the CPU are noise. So a plain `playwright test` never includes perf, and a
//                    perf run can never pick up the e2e projects.
//
// Gate 5/6:  pnpm exec playwright test                     (unit, chromium, webkit, mobile-chromium)
// Gate 7:    PW_PERF=1 pnpm exec playwright test --project=perf
//            Run it alone: no workflow active, no dev server, nothing else keeping the machine busy.
// Remote:    BASE_URL=https://… pnpm exec playwright test --project=chromium --project=webkit --grep-invert @form
//            (RULES Hard rule 6: never submit the form against a remote URL; @form specs also skip themselves.)
//
// Evidence (review rounds copy these to .redesign/qa/round-N/): test-results/screens/*.png,
// test-results/axe/*.json, test-results/hero/*.json, test-results/perf/frame-time.json.
const PORT = Number(process.env.PORT || 3100);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
// `--project unit` needs no server (and no QA build): skip webServer when only unit runs.
const projectArgs = process.argv.flatMap((a, i, all) =>
  a === "--project" ? [all[i + 1]] : a.startsWith("--project=") ? [a.slice("--project=".length)] : [],
);
const unitOnly = projectArgs.length > 0 && projectArgs.every((p) => p === "unit");
/** Gate 7 only. Registers the perf project and nothing else. */
const PERF_RUN = process.env.PW_PERF === "1";

const DESKTOP = { width: 1280, height: 800 };
const E2E = /e2e\/.*\.spec\.ts$/;
const WEBKIT_SPECS = /e2e\/(layout|keyboard|nojs|reduced-motion|no-webgl)\.spec\.ts$/;
const TOUCH = /@touch/;

type Projects = NonNullable<PlaywrightTestConfig["projects"]>;

const DEFAULT_PROJECTS: Projects = [
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
];

const PERF_PROJECTS: Projects = [
  {
    name: "perf",
    testMatch: /perf\/.*\.spec\.ts$/,
    workers: 1,
    use: { ...devices["Desktop Chrome"], viewport: DESKTOP },
  },
];

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: !PERF_RUN,
  workers: PERF_RUN ? 1 : 2,
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
  projects: PERF_RUN ? PERF_PROJECTS : DEFAULT_PROJECTS,
  webServer: isLocal && !unitOnly
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
