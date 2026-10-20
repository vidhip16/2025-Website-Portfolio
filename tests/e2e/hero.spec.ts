import { expect, test, type Page } from "@playwright/test";
import { person } from "../../content/site";
import {
  SEL,
  gotoAndSettle,
  heroProgressY,
  scrollToY,
  settleApp,
  waitForStableBox,
  writeEvidence,
} from "./helpers";

// Blueprint §3.1 layout gates (hero overlap, locked "Patel" layers) and the §5.2 hand-off check.
// Chromium only (WebKit's matrix is layout, keyboard, no-JS, reduced-motion and no-WebGL).

type Box = { x: number; y: number; width: number; height: number };

/**
 * Tight text boxes for the two name words (a Range over the glyphs, not the block-level line box,
 * which spans the full width and would make every overlap look small).
 */
async function wordBoxes(page: Page): Promise<{ first: Box; last: Box }> {
  return page.evaluate(
    ({ firstName, lastName, realSel }) => {
      const textBox = (root: Element | null, word: string): Box | null => {
        if (!root) return null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const i = n.nodeValue?.indexOf(word) ?? -1;
          if (i < 0) continue;
          const range = document.createRange();
          range.setStart(n, i);
          range.setEnd(n, i + word.length);
          const r = range.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
        // Letters split into spans: fall back to the union of the element's contents.
        const range = document.createRange();
        range.selectNodeContents(root);
        const r = range.getBoundingClientRect();
        return r.width > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      };
      const h1 = document.querySelector("#home h1");
      const firstHost = h1
        ? (Array.from(h1.children).find((c) => !c.classList.contains("name-patel")) ?? h1)
        : null;
      const first = textBox(firstHost, firstName);
      const last = textBox(document.querySelector(realSel), lastName);
      if (!first || !last) throw new Error("could not measure the name words");
      return { first, last };
    },
    { firstName: person.firstName, lastName: person.lastName, realSel: SEL.patelReal },
  );
}

/**
 * Fraction of each word box covered by Ping: the rect overlap with the Ping image box, and the
 * alpha-aware overlap (opaque pixels of the cut-out only, sampled every 2 CSS px). The gate uses
 * the alpha figure, because the image box includes transparent margin that covers nothing.
 */
async function pingCoverage(page: Page, words: { first: Box; last: Box }) {
  return page.evaluate(
    async ({ words, figureSel }) => {
      const img = document.querySelector<HTMLImageElement>(`${figureSel} img`);
      if (!img) throw new Error("no Ping image in figure.ping");
      await img.decode().catch(() => undefined);
      const box = img.getBoundingClientRect();

      // Where the bitmap is drawn inside the box (object-fit fill | contain | cover, centred).
      const fit = getComputedStyle(img).objectFit;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      let cw = box.width;
      let ch = box.height;
      if (fit === "contain" || fit === "cover") {
        const s = (fit === "contain" ? Math.min : Math.max)(box.width / nw, box.height / nh);
        cw = nw * s;
        ch = nh * s;
      }
      const content = { x: box.x + (box.width - cw) / 2, y: box.y + (box.height - ch) / 2, w: cw, h: ch };

      const W = 320;
      const H = Math.max(1, Math.round((W * nh) / nw));
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, W, H);
      const alpha = ctx.getImageData(0, 0, W, H).data;
      const opaqueAt = (x: number, y: number) => {
        if (x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) return false;
        const u = (x - content.x) / content.w;
        const v = (y - content.y) / content.h;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
        return alpha[(Math.floor(v * H) * W + Math.floor(u * W)) * 4 + 3] > 128;
      };

      const cover = (w: { x: number; y: number; width: number; height: number }) => {
        const ix = Math.max(0, Math.min(w.x + w.width, box.x + box.width) - Math.max(w.x, box.x));
        const iy = Math.max(0, Math.min(w.y + w.height, box.y + box.height) - Math.max(w.y, box.y));
        const rect = (ix * iy) / (w.width * w.height);
        const step = 2;
        let hit = 0;
        let n = 0;
        for (let y = w.y + step / 2; y < w.y + w.height; y += step) {
          for (let x = w.x + step / 2; x < w.x + w.width; x += step) {
            n++;
            if (opaqueAt(x, y)) hit++;
          }
        }
        return { rect, alpha: n ? hit / n : 0 };
      };
      return {
        image: { x: box.x, y: box.y, width: box.width, height: box.height, objectFit: fit },
        first: cover(words.first),
        last: cover(words.last),
      };
    },
    { words, figureSel: SEL.pingFigure },
  );
}

/** Mean absolute RGB difference (0..1) of two PNGs, compared at 1/8 scale so dot texture averages out. */
async function lowResDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([pa, pb]) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = `data:image/png;base64,${b64}`;
        });
      const [ia, ib] = await Promise.all([load(pa), load(pb)]);
      const w = Math.max(8, Math.round(ia.naturalWidth / 8));
      const h = Math.max(8, Math.round(ia.naturalHeight / 8));
      const pixels = (img: HTMLImageElement) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = pixels(ia);
      const db = pixels(ib);
      let sum = 0;
      for (let i = 0; i < da.length; i += 4) {
        sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      }
      return sum / ((da.length / 4) * 3 * 255);
    },
    [a.toString("base64"), b.toString("base64")] as const,
  );
}

test.describe("hero", () => {
  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    // unblocked: Phase 4
    test(`Ping covers at most 30% of each name word at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await gotoAndSettle(page, "/");
      await expect(page.locator(`${SEL.pingFigure} img`).first()).toBeVisible();
      await settleApp(page);

      const words = await wordBoxes(page);
      const cover = await pingCoverage(page, words);
      writeEvidence(info, `hero/${info.project.name}-overlap-${width}.json`, { width, height, words, ...cover });

      expect(cover.first.alpha, `Ping covers ${(cover.first.alpha * 100).toFixed(1)}% of "${person.firstName}"`).toBeLessThanOrEqual(0.3);
      expect(cover.last.alpha, `Ping covers ${(cover.last.alpha * 100).toFixed(1)}% of "${person.lastName}"`).toBeLessThanOrEqual(0.3);
    });
  }

  // unblocked: Phase 4
  test("at hero progress .3 the real and duplicate Patel lines match within 1px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }); // the pin runs at ≥ 1024 px
    await gotoAndSettle(page, "/");
    await settleApp(page);
    await expect(page.locator(`.pin-spacer #home`), "the hero is not pinned").toHaveCount(1);

    const real = page.locator(SEL.patelReal);
    const dup = page.locator(SEL.patelDup);
    await expect(real).toHaveCount(1);
    await expect(dup).toHaveCount(1);

    await scrollToY(page, await heroProgressY(page, 0.3));
    await waitForStableBox(real);
    await waitForStableBox(dup);

    // The tween has actually moved the pair (otherwise this compares two static boxes).
    expect(await real.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");

    const a = (await real.boundingBox())!;
    const b = (await dup.boundingBox())!;
    for (const k of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(a[k] - b[k]), `real vs duplicate "${person.lastName}" ${k}`).toBeLessThanOrEqual(1);
    }
  });

  // unblock: Phase 5
  test.fixme("the hand-off frame lines up with the still (one frame either side of .48)", async ({ page }, info) => {
    // §5.2: screenshots either side of hero progress 0.48 differ by < 3% inside the Ping rect.
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, "/");
    await settleApp(page);
    const figure = page.locator(SEL.pingFigure);

    await scrollToY(page, await heroProgressY(page, 0.47));
    const rect = (await waitForStableBox(figure))!;
    const clip = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const before = await page.screenshot({ clip, animations: "disabled" });

    await scrollToY(page, await heroProgressY(page, 0.49));
    await waitForStableBox(figure);
    await page.waitForTimeout(1100); // scrub: 1
    const after = await page.screenshot({ clip, animations: "disabled" });

    const diff = await lowResDiff(page, before, after);
    writeEvidence(info, `hero/${info.project.name}-handoff.json`, { clip, diff });
    expect(diff, "still → dots hand-off differs inside the Ping rect").toBeLessThan(0.03);
  });
});
