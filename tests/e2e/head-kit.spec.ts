import { expect, test } from "@playwright/test";
import { PROJECTS } from "./helpers";

// Blueprint §12 definition of done: head kit, SEO endpoints and JSON-LD on the running server.
// Chromium only. Uses the request fixture (baseURL + extraHTTPHeaders from the config).

/** Width and height from a PNG's IHDR chunk. */
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

  // unblock: Phase 6
  test.fixme("icons return 200", async ({ request }) => {
    for (const path of ["/icon.svg", "/apple-icon.png"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  // unblock: Phase 6
  test.fixme("OG images are 1200×630 PNGs and each og:image matches its route", async ({ page, request }) => {
    const routes = [{ path: "/", og: "/opengraph-image" }, ...PROJECTS.map((p) => ({ path: `/work/${p.slug}`, og: `/work/${p.slug}/opengraph-image` }))];
    for (const r of routes) {
      const res = await request.get(r.og);
      expect(res.status(), r.og).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      expect(pngSize(await res.body()), r.og).toEqual({ width: 1200, height: 630 });

      await page.goto(r.path);
      const content = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      expect(content, `og:image on ${r.path}`).toBeTruthy();
      // The host is production by design (metadataBase); only the path has to match the route.
      expect(new URL(content!).pathname.startsWith(r.og), `og:image path on ${r.path}`).toBe(true);
    }
  });
});
