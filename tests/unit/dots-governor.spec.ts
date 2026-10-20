// Unit tests for the dot stage's frame governor (components/dots/layout.ts, blueprint §5.5):
// p90 of 90 rendered-frame intervals over 20 ms drops a tier. Project "unit": Node only.
// Gate 7 holds the tier in QA builds (window.__dotsHoldTier), so this is where the drop rule
// itself is checked.
import { expect, test } from "@playwright/test";
import { FrameGovernor } from "../../components/dots/layout";

/** Push `n` intervals of `ms`; true if any push asked for a drop. */
function feed(g: FrameGovernor, n: number, ms: number): boolean {
  let dropped = false;
  for (let i = 0; i < n; i++) dropped = g.push(ms) || dropped;
  return dropped;
}

test.describe("dot frame governor", () => {
  test("a steady 60 fps never drops", () => {
    const g = new FrameGovernor();
    expect(feed(g, g.warmup + g.frames * 5, 16.7)).toBe(false);
  });

  test("a full window with p90 over the limit drops once, then starts a new window", () => {
    const g = new FrameGovernor();
    expect(feed(g, g.warmup, 40)).toBe(false); // warm-up frames are ignored
    expect(feed(g, g.frames - 1, 33.3)).toBe(false); // the window is not full yet
    expect(g.push(33.3)).toBe(true); // the 90th frame closes it
    expect(feed(g, g.frames - 1, 33.3)).toBe(false); // a fresh window
  });

  test("10% slow frames reach p90; 9 of 90 do not", () => {
    const nine = new FrameGovernor();
    feed(nine, nine.warmup, 16.7);
    expect(feed(nine, 81, 16.7) || feed(nine, 9, 40)).toBe(false);

    const ten = new FrameGovernor();
    feed(ten, ten.warmup, 16.7);
    feed(ten, 80, 16.7);
    expect(feed(ten, 10, 40)).toBe(true);
  });

  test("stalls (over 250 ms) and non-positive intervals are not counted", () => {
    const g = new FrameGovernor();
    feed(g, g.warmup, 16.7);
    expect(feed(g, g.frames * 2, 400)).toBe(false);
    expect(feed(g, g.frames * 2, 0)).toBe(false);
    expect(feed(g, g.frames - 1, 16.7)).toBe(false);
    expect(g.push(16.7)).toBe(false); // only the 90 real frames closed the window
  });

  test("reset() restarts the warm-up and the window", () => {
    const g = new FrameGovernor();
    feed(g, g.warmup, 16.7);
    feed(g, g.frames - 1, 40);
    g.reset();
    expect(feed(g, g.warmup, 40)).toBe(false); // warm-up again
    expect(feed(g, g.frames - 1, 40)).toBe(false);
    expect(g.push(40)).toBe(true);
  });
});
