// Shared view-transition identity for the cover → detail-hero morph (§6.3).
// Exactly one mounted element per slug carries this name on each page: the
// canonical cover tile (first copy) on `/` and the hero on `/work/<slug>`.
import type { ViewTransitionClass } from "react";

/** Transition type added only by a click/Enter on a canonical cover tile. */
export const MORPH_TYPE = "work-morph";

export const morphName = (slug: string) => `p-${slug}`;

/**
 * `share` resolves to the `morph` class (520 ms quint in globals.css) only for
 * navigations that carry MORPH_TYPE. Print tiles, clones, the index, the list
 * view and browser back/forward navigate without it, so they never morph, even
 * though the canonical tile with the same name is still mounted.
 */
export const MORPH_SHARE: ViewTransitionClass = { [MORPH_TYPE]: "morph", default: "none" };
