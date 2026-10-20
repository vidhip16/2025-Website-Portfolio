// UI strings for the Work section and the /work/[slug] pages that content/site.ts
// does not hold yet. They are interface labels from the blueprint (§6.3, §6.4),
// not claims about Vidhi. Requested as `work.*` keys in content/site.ts; once the
// lead adds them there, this file re-exports them and nothing else changes.
export const workCopy = {
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
} as const;
