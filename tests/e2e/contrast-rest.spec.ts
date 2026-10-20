import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { gotoAndSettle, heroProgressY, scrollToY, settleApp, writeEvidence } from "./helpers";

// WCAG 1.4.3 where the visitor can stop (round-1 a11y finding wcag-1.4.3-scrubbed-room-tween-contrast).
// The paper to night change is a short time-based fade between two complete palettes, so wherever the
// scroll rests, even in the middle of a tween's band, the page text has at least AA contrast. axe only
// audits the page at the top and at one chapter, so this parks the scroll at the quarter, the middle
// and the three-quarter point of the hero's colour band (desktop) and of the room's enter and exit
// (phones and desktop), waits for the scrubs and the fade to settle, and checks the body's text
// against its ground, and that the phone veil (the compositor blend) is off at rest.
// Evidence: test-results/contrast/<project>-<case>.json.

type Rgb = [number, number, number];

function parseColour(css: string): Rgb {
  const m = css.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) throw new Error(`cannot read the colour "${css}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Wait for the ScrollTrigger scrubs (about 1 s) and the palette fade (0.28 s), then read the body. */
async function restColours(page: Page) {
  await page.waitForTimeout(1600);
  return page.evaluate(() => {
    const style = getComputedStyle(document.body);
    const veil = document.querySelector<HTMLElement>("[data-room-veil]");
    return {
      fg: style.color,
      bg: style.backgroundColor,
      veil: veil ? Number(getComputedStyle(veil).opacity) : 0,
      night: document.body.dataset.room === "night",
    };
  });
}

async function expectAaAt(page: Page, info: TestInfo, name: string, y: number) {
  await scrollToY(page, Math.max(0, Math.round(y)));
  const rest = await restColours(page);
  const ratio = contrast(parseColour(rest.fg), parseColour(rest.bg));
  writeEvidence(info, `contrast/${info.project.name}-${name}.json`, { y: Math.round(y), ...rest, ratio });
  expect(ratio, `${name}: ${rest.fg} on ${rest.bg}`).toBeGreaterThanOrEqual(4.5);
  expect(rest.veil, `${name}: the veil is off at rest`).toBeLessThan(0.02);
}

/** Document Y of #about's top and bottom edges. */
const aboutEdges = (page: Page) =>
  page.evaluate(() => {
    const r = document.getElementById("about")?.getBoundingClientRect();
    if (!r) throw new Error("#about is missing");
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, vh: window.innerHeight };
  });

test.describe("text contrast at rest inside the colour tweens", () => {
  test("desktop: parked inside the hero's night band", async ({ page }, info) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    // The night switch is at progress .75; park either side of it and well inside the old band.
    for (const p of [0.55, 0.65, 0.74, 0.76, 0.85, 0.95]) {
      await expectAaAt(page, info, `hero-p${Math.round(p * 100)}`, await heroProgressY(page, p));
    }
  });

  test("desktop: parked inside the room's exit", async ({ page }, info) => {
    await gotoAndSettle(page, "/");
    await settleApp(page);
    const { bottom, vh } = await aboutEdges(page);
    // exit: #about "bottom bottom" (0) to "bottom 70%" (1); the switch back is at .5.
    for (const [name, f] of [["exit-25", 0.925], ["exit-45", 0.865], ["exit-55", 0.835], ["exit-75", 0.775]] as const) {
      await expectAaAt(page, info, name, bottom - f * vh);
    }
  });

  test.describe("phone width", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("parked inside the room's enter and exit", async ({ page }, info) => {
      await gotoAndSettle(page, "/");
      await settleApp(page);
      const { top, bottom, vh } = await aboutEdges(page);
      // enter: #about "top bottom" (0) to "top 40%" (1): the top at 100% .. 40% of the viewport.
      for (const [name, f] of [["enter-25", 0.85], ["enter-45", 0.73], ["enter-55", 0.67], ["enter-75", 0.55]] as const) {
        await expectAaAt(page, info, `phone-${name}`, top - f * vh);
      }
      for (const [name, f] of [["exit-25", 0.925], ["exit-45", 0.865], ["exit-55", 0.835], ["exit-75", 0.775]] as const) {
        await expectAaAt(page, info, `phone-${name}`, bottom - f * vh);
      }
    });
  });
});
