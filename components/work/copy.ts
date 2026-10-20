// TEMPORARY SHIM, pending the lead (content/* is lead-owned).
//
// Every interface label the Work section and /work/[slug] use that
// content/site.ts does not hold yet. This object is the exact `work.ui` block
// requested for content/site.ts (same keys, order and values): they are
// interface labels from the blueprint (§6.3, §6.4), not claims about Vidhi.
//
// Once `work.ui` is in content/site.ts, delete this file and read `work.ui`
// from "@/content/site" in its three importers: components/work/Work.tsx,
// app/work/[slug]/page.tsx and app/work/[slug]/opengraph-image.tsx. Nothing
// else in components/work or app/work holds interface copy.
import { person } from "@/content/site";

export const workUi = {
  /** Cursor bubble over a mosaic tile (fine pointers only). */
  viewBubble: "View",
  /** Detail page: heading above the project's tags. */
  builtWith: "Built with",
  /** Detail page: the repository button. */
  viewCode: "View code on GitHub",
  /** Detail page: returns to the mosaic at the stored scroll position. */
  back: "Back to the gallery",
  /** Detail page: heading above the regraded original artwork. */
  original: "Original artwork",
  /** Detail page: prev/next labels and their landmark name. */
  prev: "Previous project",
  next: "Next project",
  moreProjects: "More projects",
  /** Alt text of the /work/[slug] Open Graph card. */
  ogAlt: `A project from ${person.name}'s portfolio`,
} as const;
