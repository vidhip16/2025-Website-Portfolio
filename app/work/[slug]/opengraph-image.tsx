import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { person, work } from "@/content/site";
import { getProject, getProjects, type Project } from "@/content/projects";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = work.ui.ogAlt;

// Prerender one card per verified project (re-exported to the image route).
export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

const ROOT = process.cwd();
// Satori takes ttf/otf/woff, without variation axes. Revision R1 type: Instrument
// Serif for the title, static Instrument Sans instances for labels and tags.
const font = (f: string) => readFile(join(ROOT, "assets/fonts", f)).catch(() => null);
const [serif, sans500, sans650] = await Promise.all([
  font("InstrumentSerif-Regular.ttf"),
  font("InstrumentSans-500.ttf"),
  font("InstrumentSans-650.ttf"),
]);
const FONTS = [
  serif && { name: "ISerif", data: serif, weight: 400 as const, style: "normal" as const },
  sans500 && { name: "ISans", data: sans500, weight: 500 as const, style: "normal" as const },
  sans650 && { name: "ISans", data: sans650, weight: 600 as const, style: "normal" as const },
].filter((f): f is NonNullable<typeof f> => Boolean(f));
const sticker = (() => {
  try {
    return `data:image/png;base64,${readFileSync(join(ROOT, "assets/og/sticker-wave.png")).toString("base64")}`;
  } catch {
    return null;
  }
})();

const INK = "#23162E";
const PAPER = "#F6F1FA";
const ORCHID = "#6A3FD3";
const FLAT = ["#5EC8FF", "#FF86B5", "#F5DC86", "#B7A3F0"]; // arcade, bubblegum, butter, lilac

const PAD_L = 72;
const PAD_R = 80;
const GAP = 72;
const MAT = 12;
const CARD_H = 480;
const CARD_W = (CARD_H * 4) / 5;
/** Satori only wraps text inside a known width. */
const TEXT_W = size.width - PAD_L - PAD_R - GAP - (CARD_W + MAT * 2);

/**
 * The 4:5 card art. Satori/resvg can't decode WebP, so the cover file itself
 * (public/work/covers/*.webp) is never used here. In order:
 * 1. assets/og/<slug>.jpg|png: a JPEG/PNG export of the H8 cover
 * 2. null → a flat token colour with grain
 */
function cardArt(project: Project): string | null {
  // Statically scoped to assets/og so file tracing doesn't pull in the whole project.
  for (const [ext, type] of [["jpg", "image/jpeg"], ["png", "image/png"]] as const) {
    try {
      return `data:${type};base64,${readFileSync(join(process.cwd(), "assets", "og", `${project.slug}.${ext}`)).toString("base64")}`;
    } catch {
      /* try the next source */
    }
  }
  return null;
}

function grain(): string | null {
  try {
    return `data:image/png;base64,${readFileSync(join(ROOT, "public/grain.png")).toString("base64")}`;
  } catch {
    return null;
  }
}

const titleSize = (title: string) => (title.length <= 12 ? 118 : title.length <= 18 ? 100 : 84);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return new Response("Not found", { status: 404 });

  const art = cardArt(project);
  const tile = grain();
  // Projects without art get distinct flat colours.
  const at = getProjects()
    .filter((p) => !p.original)
    .findIndex((p) => p.slug === project.slug);
  const flat = FLAT[Math.max(0, at) % FLAT.length];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: GAP,
          padding: `0 ${PAD_R}px 0 ${PAD_L}px`,
          position: "relative",
          background: PAPER,
          backgroundImage:
            "radial-gradient(520px 420px at 82% 92%, rgba(255,134,181,0.28), transparent 70%), radial-gradient(460px 360px at 6% 8%, rgba(94,200,255,0.14), transparent 70%), radial-gradient(700px 520px at 30% 55%, rgba(183,163,240,0.26), transparent 70%)",
          color: INK,
          fontFamily: "ISans",
        }}
      >
        {tile && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              opacity: 0.07,
              backgroundImage: `url(${tile})`,
              backgroundSize: "256px 256px",
              backgroundRepeat: "repeat",
            }}
          />
        )}
        {/* The print: 4:5 card on a paper mat, tilted like the wall labels. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexShrink: 0,
            padding: MAT,
            background: "#FFFFFF",
            borderRadius: 30,
            boxShadow: "0 22px 48px rgba(35,22,46,0.18)",
            transform: "rotate(-2deg)",
          }}
        >
          {art ? (
            <img
              src={art}
              width={CARD_W}
              height={CARD_H}
              alt=""
              style={{ borderRadius: 22, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: CARD_W,
                height: CARD_H,
                borderRadius: 22,
                background: flat,
                overflow: "hidden",
              }}
            >
              {tile && (
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    opacity: 0.13,
                    backgroundImage: `url(${tile})`,
                    backgroundSize: "256px 256px",
                    backgroundRepeat: "repeat",
                  }}
                />
              )}
            </div>
          )}
          {sticker && (
            // Ping waves from the print's corner: the layer in front of the art.
            <img
              src={sticker}
              width={116}
              height={168}
              alt=""
              style={{ position: "absolute", right: -46, bottom: -30, transform: "rotate(6deg)" }}
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: TEXT_W }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: ORCHID }}>{person.name}</div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontFamily: "ISerif",
              fontSize: titleSize(project.title),
              lineHeight: 0.95,
              letterSpacing: -2,
            }}
          >
            {project.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
            {project.tags.slice(0, 3).map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  padding: "8px 22px",
                  border: `2px solid ${INK}`,
                  borderRadius: 999,
                  fontSize: 26,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: FONTS.length ? FONTS : undefined,
    },
  );
}
