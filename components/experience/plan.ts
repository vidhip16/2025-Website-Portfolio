// Pure geometry for the two-lane branch diagram (blueprint §3.4).
// Time runs left to right: one equal column per year from the first start to
// the last dated year, plus one "present" tail column. The HTML list (a CSS
// subgrid) and the SVG lanes (percentage coordinates) share these numbers, so
// the text under each node and the node itself line up at every width.
import type { Role } from "@/content/site";

export type Lane = Role["lane"];

export const LANE_ORDER: readonly Lane[] = ["study", "work"];

/** Band between the two text rows that holds both lanes (px). */
export const BAND_H = 96;
/** Lane centre lines inside the band (px). Study sits above, Work below. */
export const LANE_Y: Record<Lane, number> = { study: 24, work: 72 };

export type PlacedRole = {
  role: Role;
  /** 1-based grid line where the entry (and its node) starts. */
  colStart: number;
  /** Grid line where the entry's text may run to (-1 = the end). */
  colEnd: number;
  /** Node x, in % of the lane width. */
  x: number;
};

export type Segment = { lane: Lane; x1: number; x2: number };

export type BranchPlan = {
  cols: number;
  lanes: Lane[];
  placed: PlacedRole[];
  segments: Segment[];
};

const round = (n: number) => Math.round(n * 1000) / 1000;

export function planBranches(roles: readonly Role[]): BranchPlan {
  if (!roles.length) return { cols: 1, lanes: [], placed: [], segments: [] };

  const first = Math.min(...roles.map((r) => r.start));
  const last = Math.max(...roles.flatMap((r) => (r.end === null ? [r.start] : [r.start, r.end])));
  const cols = last - first + 2;
  const col = (year: number) => year - first + 1;
  const xOf = (year: number) => round(((year - first) / cols) * 100);

  const lanes = LANE_ORDER.filter((l) => roles.some((r) => r.lane === l));

  const placed = roles.map((role): PlacedRole => {
    const next = roles
      .filter((o) => o.lane === role.lane && o.start > role.start)
      .sort((a, b) => a.start - b.start)[0];
    return {
      role,
      colStart: col(role.start),
      colEnd: next ? col(next.start) : -1,
      x: xOf(role.start),
    };
  });

  // One stitched segment per role (start → end, or → the edge while ongoing),
  // merged where a lane's roles run on from one another.
  const segments: Segment[] = [];
  for (const lane of lanes) {
    const spans = roles
      .filter((r) => r.lane === lane)
      .map((r) => ({ x1: xOf(r.start), x2: r.end === null ? 100 : xOf(r.end) }))
      .sort((a, b) => a.x1 - b.x1);
    let cur: Segment | null = null;
    for (const s of spans) {
      if (cur && s.x1 <= cur.x2) {
        cur.x2 = Math.max(cur.x2, s.x2);
      } else {
        if (cur) segments.push(cur);
        cur = { lane, x1: s.x1, x2: Math.max(s.x2, s.x1) };
      }
    }
    if (cur) segments.push(cur);
  }

  return { cols, lanes, placed, segments };
}
