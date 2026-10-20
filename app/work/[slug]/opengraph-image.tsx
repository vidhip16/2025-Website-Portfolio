import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { person } from "@/content/site";
import { getProject, getProjects, type Project } from "@/content/projects";
import { workUi } from "@/components/work/copy";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = workUi.ogAlt;

// Prerender one card per verified project (re-exported to the image route).
export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

const ROOT = process.cwd();
// Satori takes ttf/otf/woff. Read once at module scope (a predictable value).
const fraunces = await readFile(join(ROOT, "assets/fonts/Fraunces-800.ttf")).catch(() => null);

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
 * 1. assets/og/<slug>.jpg|png: a JPEG/PNG export of the H8 cover (lead adds these)
 * 2. the regraded original print (public/work/originals/<slug>.jpg)
 * 3. null → a flat token colour with grain
 */
function cardArt(project: Project): string | null {
  const candidates: [string, string][] = [
    [join(ROOT, "assets/og", `${project.slug}.jpg`), "image/jpeg"],
    [join(ROOT, "assets/og", `${project.slug}.png`), "image/png"],
  ];
  if (project.original?.src.endsWith(".jpg")) {
    candidates.push([join(ROOT, "public", project.original.src), "image/jpeg"]);
  }
  for (const [file, type] of candidates) {
    try {
      return `data:${type};base64,${readFileSync(file).toString("base64")}`;
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

const titleSize = (title: string) => (title.length <= 12 ? 104 : title.length <= 18 ? 88 : 72);

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
          background: PAPER,
          color: INK,
          fontFamily: fraunces ? "Fraunces" : undefined,
        }}
      >
        {/* The print: 4:5 card on a paper mat, tilted like the wall labels. */}
        <div
          style={{
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: TEXT_W }}>
          <div style={{ display: "flex", fontSize: 34, color: ORCHID }}>{person.name}</div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: titleSize(project.title),
              lineHeight: 0.98,
              letterSpacing: -1.5,
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
                  border: `3px solid ${INK}`,
                  borderRadius: 999,
                  fontSize: 28,
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
      fonts: fraunces ? [{ name: "Fraunces", data: fraunces, weight: 800, style: "normal" }] : undefined,
    },
  );
}
