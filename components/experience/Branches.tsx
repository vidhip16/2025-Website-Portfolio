import type { CSSProperties } from "react";
import { experience, onlyVerified, type Role } from "@/content/site";
import { BAND_H, LANE_Y, planBranches } from "./plan";
import { BranchesMotion } from "./BranchesMotion";

const MASK_ID = "branches-draw";

/** "2023 to present" / "2023 to 2026", words from `experience.dates`. */
function Years({ role }: { role: Role }) {
  const { to, present } = experience.dates;
  return (
    <>
      <time dateTime={String(role.start)}>{role.start}</time> {to}{" "}
      {role.end === null ? present : <time dateTime={String(role.end)}>{role.end}</time>}
    </>
  );
}

/**
 * Experience (blueprint §3.4). One ordered list is the content at every size:
 * on mobile a single column on a stitched left rail; from lg it becomes a
 * subgrid laid over a server-rendered SVG of two lanes, Study above and Work
 * below, with each entry starting at its real year. The SVG is decoration
 * (aria-hidden); BranchesMotion lazily scrubs the lanes' draw-in.
 */
export function Branches() {
  const roles: Role[] = onlyVerified(experience.roles);
  const { cols, lanes, placed, segments } = planBranches(roles);

  // Only applies once `lg:grid` turns the wrapper into a grid.
  const grid: CSSProperties = {
    gridTemplateColumns: `7rem repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `auto ${BAND_H}px auto`,
  };

  return (
    <section id="experience" aria-labelledby="exp-title" className="px-[var(--gutter)] py-24 lg:py-32">
      <span id="resume" />
      <div className="mx-auto max-w-[1440px]">
        <h2 id="exp-title" className="text-[clamp(2.75rem,5vw,4.5rem)] leading-none tracking-[-0.02em]">
          {experience.heading}
        </h2>

        <div className="mt-12 lg:mt-20 lg:grid" style={grid}>
          <ol
            data-branches-list=""
            className={[
              // Mobile: one column, 2px stitched rail in the left gutter.
              "relative flex flex-col gap-10",
              "before:absolute before:inset-y-2 before:left-[7px] before:w-[2px]",
              "before:bg-[repeating-linear-gradient(to_bottom,var(--ink)_0_3px,transparent_3px_9px)]",
              "forced-colors:before:bg-none forced-colors:before:bg-[color:CanvasText]",
              // Desktop: subgrid over the year columns and the three rows.
              "lg:col-[2/-1] lg:row-[1/4] lg:grid lg:grid-cols-subgrid lg:grid-rows-subgrid lg:gap-0 lg:before:hidden",
            ].join(" ")}
          >
            {placed.map(({ role, colStart, colEnd }) => (
              <li
                key={role.id}
                data-lane={role.lane}
                data-current={role.current ? "" : undefined}
                style={{ gridColumn: `${colStart} / ${colEnd}`, gridRow: role.lane === "study" ? 1 : 3 }}
                className={[
                  "relative pl-10",
                  "before:absolute before:left-0 before:top-1 before:size-4 before:rounded-full",
                  "before:border-2 before:border-ink before:bg-paper data-[current]:before:bg-butter",
                  "forced-colors:before:border-[color:CanvasText] forced-colors:data-[current]:before:bg-[color:Highlight]",
                  "lg:pl-0 lg:pr-8 lg:before:hidden",
                  role.lane === "study" ? "lg:self-end" : "lg:self-start",
                ].join(" ")}
              >
                <p className="text-[0.95rem] font-semibold leading-6 text-ink/75 lg:sr-only">
                  {experience.lanes[role.lane]}
                </p>
                <p className="mt-1 font-display text-[1.875rem] leading-tight tracking-[-0.01em] lg:mt-0">
                  <Years role={role} />
                </p>
                <h3 className="mt-2 text-lg leading-snug">
                  <span className="block font-sans font-semibold">{role.title}</span>
                  <span className="block font-sans font-normal">{role.org}</span>
                </h3>
                {role.description && <p className="mt-3 max-w-[60ch]">{role.description}</p>}
              </li>
            ))}
          </ol>

          {/* Lane names beside the band; the list carries them for assistive tech. */}
          <div aria-hidden="true" className="relative hidden lg:col-start-1 lg:row-start-2 lg:block">
            {lanes.map((lane) => (
              <span
                key={lane}
                className="absolute left-0 -translate-y-1/2 text-base font-semibold leading-none"
                style={{ top: LANE_Y[lane] }}
              >
                {experience.lanes[lane]}
              </span>
            ))}
          </div>

          <svg
            data-branches=""
            aria-hidden="true"
            focusable="false"
            width="100%"
            height={BAND_H}
            className="hidden overflow-visible text-ink lg:col-[2/-1] lg:row-start-2 lg:block"
          >
            <defs>
              {/* The stitches are revealed through this mask; BranchesMotion scrubs
                  its lines' stroke-dashoffset. Without motion it stays fully drawn. */}
              <mask
                id={MASK_ID}
                maskUnits="userSpaceOnUse"
                x="-2%"
                y="0"
                width="104%"
                height="100%"
                style={{ forcedColorAdjust: "none" }}
              >
                {segments.map((s) => (
                  <line
                    key={`${s.lane}-${s.x1}`}
                    data-branch-draw=""
                    data-x1={s.x1}
                    data-x2={s.x2}
                    x1={`${s.x1}%`}
                    x2={`${s.x2}%`}
                    y1={LANE_Y[s.lane]}
                    y2={LANE_Y[s.lane]}
                    stroke="#fff"
                    strokeWidth={10}
                  />
                ))}
              </mask>
            </defs>
            <g mask={`url(#${MASK_ID})`} fill="none" stroke="currentColor" strokeWidth={2}>
              {segments.map((s) => (
                <line
                  key={`${s.lane}-${s.x1}`}
                  x1={`${s.x1}%`}
                  x2={`${s.x2}%`}
                  y1={LANE_Y[s.lane]}
                  y2={LANE_Y[s.lane]}
                  strokeDasharray="3 6"
                />
              ))}
            </g>
            <g stroke="currentColor" strokeWidth={2}>
              {placed.map(({ role, x }) => (
                <circle
                  key={role.id}
                  cx={`${x}%`}
                  cy={LANE_Y[role.lane]}
                  r={role.current ? 9 : 7}
                  className={
                    role.current
                      ? "fill-butter forced-colors:fill-[Highlight]"
                      : "fill-paper forced-colors:fill-[Canvas]"
                  }
                />
              ))}
            </g>
          </svg>
        </div>
      </div>
      <BranchesMotion />
    </section>
  );
}
