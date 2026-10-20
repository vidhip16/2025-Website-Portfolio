"use client";

import { useEffect } from "react";
import type { PointTier } from "@/lib/dots/types";
import type { TierReason } from "@/lib/quality";
import { startDotStage } from "./engine";

/**
 * The WebGL dot stage (blueprint §5). Lazy: DotStageLoader reaches it through
 * `dynamic(() => import("./DotStage"), { ssr: false })`, so three.js only ever ships in this
 * chunk. Renders nothing itself: the engine prepends `canvas[data-dots]` to <body> and the
 * effect's cleanup removes every trace of it (Activity hides re-run it).
 */
export default function DotStage({
  tier,
  onFallback,
}: {
  tier: PointTier;
  onFallback: (reason: TierReason) => void;
}) {
  useEffect(() => startDotStage({ tier, onFallback }), [tier, onFallback]);
  return null;
}
