// Type-only contract for dot-stage quality tiers (blueprint §5.5).

/** T2 desktop 12k pts (DPR ≤ 1.75), T1 mobile/coarse 4k pts (DPR ≤ 1.5), T0 static halftones. */
export type Tier = "T0" | "T1" | "T2";

export type TierSpec = {
  tier: Tier;
  points: number;
  dprCap: number;
  pointSize: number;
};

/** Why the stage is on a given tier. */
export type TierReason =
  | "default"
  | "coarse-pointer"
  | "no-webgl2"
  | "context-lost"
  | "save-data"
  | "reduced-motion"
  | "governor"
  | "load-failed";

export type QualityState = {
  tier: Tier;
  reason: TierReason;
};
