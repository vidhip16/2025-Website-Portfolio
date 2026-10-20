// Render the home OG card (Revision R1, refs/type-directions/og-A.png) to
// app/opengraph-image.jpg (+ .alt.txt). A static render because the layered
// composition (front clip, blurred cast shadow, variable layout) is beyond
// Satori. Copy comes from content/site.ts; re-run after copy or art changes:
//   node scripts/make_og.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { person, mascot, seo } from "../content/site.ts";

const root = path.resolve(import.meta.dirname, "..");
const url = (p) => pathToFileURL(path.join(root, p)).href;
const mono = fs.readFileSync(path.join(root, "components/shell/monogram-paths.ts"), "utf8");
const pick = (re) => mono.match(re)[1];
// Ping body box (natural size) and where its base sits (last opaque row / height).
const PING = { w: 929, h: 1520, base: 1496 / 1520 };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let html = fs.readFileSync(path.join(root, "scripts/og/template.html"), "utf8");
const vars = {
  SERIF: url("assets/fonts/InstrumentSerif-Regular.ttf"),
  SERIF_ITALIC: url("assets/fonts/InstrumentSerif-Italic.ttf"),
  SANS500: url("assets/fonts/InstrumentSans-500.ttf"),
  SANS650: url("assets/fonts/InstrumentSans-650.ttf"),
  GRAIN: url("public/grain.png"),
  PING: url("public/ping/ping-body.png"),
  PING_W: String(PING.w), PING_H: String(PING.h), PING_BASE: String(PING.base),
  VB: pick(/VIEWBOX = "([^"]+)"/), L: pick(/LETTERS = "([^"]+)"/), E: pick(/EAR = "([^"]+)"/),
  FIRST: esc(person.firstName), LAST: esc(person.lastName),
  LEAD: esc(seo.ogLead), FOLLOW: esc(seo.ogFollow), LABEL: esc(mascot.wallLabel),
};
for (const [k, v] of Object.entries(vars)) html = html.replaceAll(`%%${k}%%`, v);
const tmp = path.join(root, "test-results", "og-render.html");
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(tmp).href);
await page.waitForSelector("body[data-ready]");
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(root, "app/opengraph-image.jpg"), type: "jpeg", quality: 90 });
await browser.close();
fs.writeFileSync(
  path.join(root, "app/opengraph-image.alt.txt"),
  `${person.name}, ${seo.ogLine}. ${mascot.alt} sits among the letters of the name.`,
);
console.log("wrote app/opengraph-image.jpg");
