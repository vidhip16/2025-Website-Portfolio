// Lazily imported by BranchesMotion (never on first load): GSAP + ScrollTrigger.
// Scrubs the mask lines' stroke-dashoffset so the stitched lanes draw in from
// left to right as the Experience section scrolls through. Desktop only (the
// SVG is hidden below lg). The returned cleanup kills the trigger and restores
// the fully drawn lanes, so it is safe to call on Activity hide or Pause.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DESKTOP_MQ } from "@/lib/motion";

export function drawLanes(svg: SVGSVGElement, section: Element): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const lines = Array.from(svg.querySelectorAll<SVGLineElement>("line[data-branch-draw]"));
  if (!lines.length) return () => {};

  // Lines use % coordinates, so their length follows the SVG's rendered width.
  const length = (line: SVGLineElement) => {
    const span = (Number(line.dataset.x2) - Number(line.dataset.x1)) / 100;
    return Math.max(1, span * svg.getBoundingClientRect().width);
  };

  const mm = gsap.matchMedia();
  mm.add(DESKTOP_MQ, () => {
    gsap.fromTo(
      lines,
      {
        strokeDasharray: (_i: number, el: SVGLineElement) => `${length(el)} ${length(el)}`,
        strokeDashoffset: (_i: number, el: SVGLineElement) => length(el),
      },
      {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 85%",
          end: "bottom 70%",
          scrub: 1,
          invalidateOnRefresh: true,
        },
      },
    );
  });

  return () => mm.revert();
}
