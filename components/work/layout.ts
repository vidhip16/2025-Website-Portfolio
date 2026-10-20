// The mosaic plan (§6.1): which cell sits where, per column. Pure data, built
// on the server from verified projects only.
//
// Per 3-column set of 15 cells: the 6 covers, 4 regraded original prints and
// 5 solid tiles (butter, lilac, arcade, bubblegum, ink). The 4th column (1600 px
// and up) adds the headshot print and 4 more solid tiles.
//
// Placement rules:
// - Columns 1 and 2 hold all six covers, so the 2-column layout (below 1024 px)
//   still shows every project.
// - A cover never sits in cell 0 of a column: the column is shifted up by part
//   of a cell (so the loop always covers the frame), which means cell 0 of the
//   first copy can never be scrolled fully into view for keyboard focus.
// - Prints avoid the column that already holds their project's cover.
import type { Project, ProjectImage } from "@/content/projects";

export type Tone = "butter" | "lilac" | "arcade" | "bubblegum" | "ink";

export type SolidThing =
  | { type: "tags"; tags: readonly string[] }
  | { type: "sticker"; index: number }
  | { type: "peek" };

export type Cell =
  | { kind: "cover"; project: Project }
  | { kind: "print"; project: Project; image: ProjectImage }
  | { kind: "headshot"; image: Pick<ProjectImage, "src" | "width" | "height"> }
  | { kind: "solid"; tone: Tone; thing: SolidThing };

export type Column = {
  cells: Cell[];
  /** Loop duration in seconds (desktop; touch uses 60 s in CSS). */
  duration: number;
  direction: "down" | "up";
  /** Designed top offset in px (relative stagger between columns). */
  offset: number;
  /** Scrubbed parallax travel across the section, in yPercent. */
  parallax: number;
  /** Smallest layout that shows this column. */
  from: "base" | "lg" | "2xl";
};

type Slot =
  | { cover: number }
  | { print: true }
  | { headshot: true }
  | { solid: Tone; thing: "tags" | "sticker" | "peek" };

type ColumnPlan = Omit<Column, "cells"> & { slots: Slot[] };

const PLAN: ColumnPlan[] = [
  {
    duration: 38,
    direction: "down",
    offset: 86,
    parallax: -6,
    from: "base",
    slots: [{ solid: "butter", thing: "tags" }, { cover: 0 }, { cover: 1 }, { print: true }, { cover: 2 }],
  },
  {
    duration: 46,
    direction: "up",
    offset: -12,
    parallax: 6,
    from: "base",
    slots: [{ print: true }, { cover: 3 }, { solid: "arcade", thing: "peek" }, { cover: 4 }, { cover: 5 }],
  },
  {
    duration: 42,
    direction: "down",
    offset: 86,
    parallax: -4,
    from: "lg",
    slots: [
      { print: true },
      { solid: "lilac", thing: "sticker" },
      { print: true },
      { solid: "ink", thing: "tags" },
      { solid: "bubblegum", thing: "sticker" },
    ],
  },
  {
    duration: 50,
    direction: "up",
    offset: -40,
    parallax: 4,
    from: "2xl",
    slots: [
      { solid: "butter", thing: "sticker" },
      { headshot: true },
      { solid: "bubblegum", thing: "peek" },
      { solid: "ink", thing: "tags" },
      { solid: "lilac", thing: "sticker" },
    ],
  },
];

/**
 * Tag clusters for the solid tiles: the projects' own tags, most used first
 * (ties keep the order they first appear in), three per cluster.
 */
function tagClusters(projects: readonly Project[]): string[][] {
  const count = new Map<string, number>();
  for (const p of projects) for (const t of p.tags) count.set(t, (count.get(t) ?? 0) + 1);
  const ranked = [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
  const clusters: string[][] = [];
  for (let i = 0; i + 3 <= ranked.length; i += 3) clusters.push(ranked.slice(i, i + 3));
  return clusters;
}

export function buildMosaic(
  projects: readonly Project[],
  headshot: Pick<ProjectImage, "src" | "width" | "height">,
): Column[] {
  const clusters = tagClusters(projects);
  const printable = projects.filter(
    (p): p is Project & { original: ProjectImage } => p.original !== undefined,
  );
  const usedPrints = new Set<string>();
  let nextCluster = 0;
  let nextSticker = 0;

  // A slot that can't be filled (fewer projects or prints) becomes a sticker tile.
  const fallback = (tone: Tone): Cell => ({ kind: "solid", tone, thing: { type: "sticker", index: nextSticker++ } });
  const FALLBACK_TONES: Tone[] = ["lilac", "butter", "arcade", "bubblegum"];

  return PLAN.map(({ slots, ...col }, ci) => {
    const coverSlugs = new Set(
      slots.flatMap((s) => ("cover" in s && projects[s.cover] ? [projects[s.cover].slug] : [])),
    );
    const cells = slots.map((slot, si): Cell => {
      const tone = FALLBACK_TONES[(ci + si) % FALLBACK_TONES.length];
      if ("cover" in slot) {
        const project = projects[slot.cover];
        return project ? { kind: "cover", project } : fallback(tone);
      }
      if ("print" in slot) {
        const pick =
          printable.find((p) => !usedPrints.has(p.slug) && !coverSlugs.has(p.slug)) ??
          printable.find((p) => !usedPrints.has(p.slug));
        if (!pick) return fallback(tone);
        usedPrints.add(pick.slug);
        return { kind: "print", project: pick, image: pick.original };
      }
      if ("headshot" in slot) return { kind: "headshot", image: headshot };
      if (slot.thing === "tags") {
        const tags = clusters[nextCluster++];
        return tags
          ? { kind: "solid", tone: slot.solid, thing: { type: "tags", tags } }
          : fallback(slot.solid);
      }
      if (slot.thing === "peek") return { kind: "solid", tone: slot.solid, thing: { type: "peek" } };
      return { kind: "solid", tone: slot.solid, thing: { type: "sticker", index: nextSticker++ } };
    });
    return { ...col, cells };
  });
}
