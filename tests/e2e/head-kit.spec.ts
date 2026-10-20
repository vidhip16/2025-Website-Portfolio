import { expect, test } from "@playwright/test";
import { PROJECTS } from "./helpers";

// Blueprint §12 definition of done: head kit, SEO endpoints and JSON-LD on the running server.
// Chromium only. Uses the request fixture (baseURL + extraHTTPHeaders from the config).

/** Width and height from a PNG's IHDR chunk. */
/** Width/height from a baseline or progressive JPEG's SOF segment. */
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return { width: 0, height: 0 };
}

function pngSize(buf: Buffer): { width: number; height: number } | null {
  const sig = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.subarray(0, 8).toString("hex") !== sig) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.describe("head kit", () => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/llms.txt"]) {
    test(`${path} returns 200`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect((await res.body()).length).toBeGreaterThan(0);
    });
  }

  test("the sitemap lists home and every detail page", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/");
    expect(paths).toContain("/");
    for (const p of PROJECTS) expect(paths).toContain(`/work/${p.slug}`);
  });

  test("every JSON-LD block parses, with Person, WebSite and ProfilePage", async ({ page }) => {
    await page.goto("/");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length, "no JSON-LD on /").toBeGreaterThan(0);
    const types = new Set<string>();
    const collect = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      const t = n["@type"];
      for (const v of Array.isArray(t) ? t : [t]) if (typeof v === "string") types.add(v);
      if (Array.isArray(n["@graph"])) n["@graph"].forEach(collect);
    };
    for (const text of blocks) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`a JSON-LD block does not parse: ${text.slice(0, 80)}…`);
      }
      (Array.isArray(parsed) ? parsed : [parsed]).forEach(collect);
    }
    for (const t of ["Person", "WebSite", "ProfilePage"]) expect([...types]).toContain(t);
  });

  // unblocked: Phase 6
  test("icons return 200", async ({ request }) => {
    for (const path of ["/icon.svg", "/apple-icon.png"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  // unblocked: Phase 6
  // The home card is a static JPEG render (DECISIONS 26); project cards are ImageResponse PNGs.
  test("OG images are 1200×630 and each og:image matches its route", async ({ page, request }) => {
    const routes = [
      { path: "/", og: "/opengraph-image.jpg", type: "image/jpeg" },
      ...PROJECTS.map((p) => ({ path: `/work/${p.slug}`, og: `/work/${p.slug}/opengraph-image`, type: "image/png" })),
    ];
    for (const r of routes) {
      const res = await request.get(r.og);
      expect(res.status(), r.og).toBe(200);
      expect(res.headers()["content-type"]).toContain(r.type);
      const body = await res.body();
      expect(r.type === "image/png" ? pngSize(body) : jpegSize(body), r.og).toEqual({ width: 1200, height: 630 });

      await page.goto(r.path);
      const content = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      expect(content, `og:image on ${r.path}`).toBeTruthy();
      // The host is production by design (metadataBase); only the path has to match the route.
      expect(new URL(content!).pathname.startsWith(r.og), `og:image path on ${r.path}`).toBe(true);
    }
  });
});
