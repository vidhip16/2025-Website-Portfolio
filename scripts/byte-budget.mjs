// Byte budgets (blueprint §8). Run after `next build`:
//   node scripts/byte-budget.mjs [--dist .next] [--strict]
// Prints a table, writes test-results/budget.json, exits 1 on any failure.
// Items whose inputs don't exist yet are "pending" (fail only with --strict).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const DIST = flag("--dist", process.env.NEXT_DIST_DIR || ".next");
const STRICT = args.includes("--strict");
const KB = 1024;

const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const read = (p) => fs.readFileSync(p);
const exists = (p) => fs.existsSync(p);
const walk = (dir, ext) =>
  exists(dir)
    ? fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, String(f))).filter((f) => f.endsWith(ext))
    : [];

if (!exists(path.join(DIST, "server/app/index.html"))) {
  console.error(`No prerendered ${DIST}/server/app/index.html. Run next build first.`);
  process.exit(1);
}

const html = read(path.join(DIST, "server/app/index.html")).toString();
const staticPath = (u) => path.join(DIST, u.replace(/^\/_next\//, ""));

// Initial JS: every script the prerendered home page references, except
// noModule polyfills (modern browsers never download them).
const scriptSrcs = [
  ...new Set(
    [...html.matchAll(/<script([^>]+)>/g)]
      .filter((m) => !/nomodule/i.test(m[1]))
      .map((m) => m[1].match(/src="([^"]+\.js)"/)?.[1])
      .filter(Boolean),
  ),
];
const initialFiles = scriptSrcs.map(staticPath).filter(exists);
const initialJs = initialFiles.reduce((s, f) => s + gz(read(f)), 0);

// CSS referenced by the home page.
const cssHrefs = [...new Set([...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]))];
const cssFiles = cssHrefs.map(staticPath).filter(exists);
const cssText = cssFiles
  .map((f) =>
    // Make url(../media/x) absolute-ish so staticPath can resolve it.
    read(f).toString().replace(/url\((?!data:)["']?([^)"']+)["']?\)/g, (_, u) =>
      `url(${u.startsWith("/") ? u : "/_next/" + path.relative(DIST, path.resolve(path.dirname(f), u))})`,
    ),
  )
  .join("\n");
const css = cssFiles.reduce((s, f) => s + gz(read(f)), 0);

// All JS (upper bound): every chunk in static/chunks.
const noModule = new Set(
  [...html.matchAll(/<script([^>]+)>/g)]
    .filter((m) => /nomodule/i.test(m[1]))
    .map((m) => m[1].match(/src="([^"]+\.js)"/)?.[1])
    .filter(Boolean)
    .map(staticPath),
);
const allChunks = walk(path.join(DIST, "static/chunks"), ".js").filter((f) => !noModule.has(f));
const allJs = allChunks.reduce((s, f) => s + gz(read(f)), 0);

// Dots chunk: the lazy chunk that carries three.js.
const dotsFiles = allChunks.filter((f) => /WebGLRenderer|ShaderMaterial/.test(read(f).toString()));
const dotsChunk = dotsFiles.length ? dotsFiles.reduce((s, f) => s + gz(read(f)), 0) : null;
const dotsInInitial = dotsFiles.some((f) => initialFiles.includes(f));

// Fonts a Latin page downloads: @font-face blocks whose unicode-range covers "A".
const coversLatin = (range) => {
  if (!range) return true;
  return range.split(",").some((r) => {
    const m = r.trim().match(/U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i);
    if (!m) return false;
    const lo = parseInt(m[1].replace(/\?/g, "0"), 16);
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, "F"), 16);
    return lo <= 0x41 && 0x41 <= hi;
  });
};
const fontUrls = new Set();
for (const block of cssText.match(/@font-face\s*{[^}]*}/g) ?? []) {
  const range = block.match(/unicode-range:\s*([^;}]+)/)?.[1];
  if (!coversLatin(range)) continue;
  for (const m of block.matchAll(/url\(([^)]+\.woff2)\)/g)) fontUrls.add(m[1].replace(/["']/g, ""));
}
const fontFiles = [...fontUrls].map(staticPath).filter(exists);
const fonts = fontFiles.reduce((s, f) => s + fs.statSync(f).size, 0);
const preloaded = [...html.matchAll(/<link[^>]+rel="preload"[^>]+href="([^"]+\.woff2)"/g)].map((m) => staticPath(m[1]));
const preloadedFonts = preloaded.filter(exists).reduce((s, f) => s + fs.statSync(f).size, 0);

// Hero critical bytes: HTML + CSS + preloaded fonts + Ping still (AVIF estimate).
let pingBytes = null;
const pingSrc = "public/ping/ping-body.png";
if (exists(pingSrc)) {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(pingSrc).metadata();
    // next/image serves roughly the rendered size at DPR 2, capped at the source.
    const h = Math.min(meta.height ?? 1800, 1800);
    pingBytes = (await sharp(pingSrc).resize({ height: h }).avif({ quality: 60 }).toBuffer()).length;
  } catch {
    pingBytes = fs.statSync(pingSrc).size;
  }
}
const heroCritical = pingBytes == null ? null : gz(Buffer.from(html)) + css + preloadedFonts + pingBytes;

const sizeOf = (p) => (exists(p) ? fs.statSync(p).size : null);
const gazeBytes = () => {
  const files = ["eyes-blank.webp", "eyes-blink.webp", "eyes-happy.webp", "pupil-l.webp", "pupil-r.webp"].map((f) => `public/ping/${f}`);
  return files.every(exists) ? files.reduce((s, f) => s + fs.statSync(f).size, 0) : null;
};

const rows = [
  ["Initial JS (gz)", initialJs, 170 * KB],
  ["Dots chunk (gz, lazy)", dotsChunk, 160 * KB],
  ["All JS, upper bound (gz)", allJs, 360 * KB],
  ["CSS (gz)", css, 25 * KB],
  ["Fonts (Latin)", fonts, 160 * KB],
  ["Hero critical bytes", heroCritical, 300 * KB],
  // Procedural gaze (DECISIONS 21) replaces the 600/180 KB atlas: all overlay
  // sprites together must stay under the mobile atlas budget.
  ["Gaze overlay sprites", gazeBytes(), 180 * KB],
];

let failed = false;
const report = rows.map(([name, value, limit]) => {
  const status = value == null ? (STRICT ? "FAIL" : "pending") : value <= limit ? "ok" : "FAIL";
  if (status === "FAIL") failed = true;
  return { name, bytes: value, limit, status };
});
if (dotsInInitial) {
  failed = true;
  report.push({ name: "three.js must not be in the initial bundle", bytes: null, limit: null, status: "FAIL" });
}

const fmt = (b) => (b == null ? "—" : `${(b / KB).toFixed(1)} KB`);
for (const r of report) console.log(`${r.status.padEnd(8)} ${r.name.padEnd(32)} ${fmt(r.bytes).padStart(10)} / ${fmt(r.limit)}`);
fs.mkdirSync("test-results", { recursive: true });
fs.writeFileSync("test-results/budget.json", JSON.stringify({ dist: DIST, report, initialFiles, fontFiles }, null, 2));
process.exit(failed ? 1 : 0);
