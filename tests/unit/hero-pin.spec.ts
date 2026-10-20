// Unit tests for lib/heroPin: positions kept "flat" (as if the hero's desktop pin were not in the
// page). Project "unit": Node only. These are the reload cases of the round-1 finding
// hero-pin-restore-double-offset.
import { expect, test } from "@playwright/test";
import { fromFlatY, toFlatY } from "../../lib/heroPin";

// A 1280 x 800 viewport: the pin is 1.4 x 800 = 1120 px long and starts at the top.
const PIN = { start: 0, end: 1120 };
const HERO = 800;

test.describe("heroPin", () => {
  test("with no pin, flat and raw positions are the same number", () => {
    expect(toFlatY(3000, null)).toBe(3000);
    expect(fromFlatY(3000, null, HERO)).toBe(3000);
  });

  test("past the hero, a raw position loses the pin length and gets it back", () => {
    expect(toFlatY(3000, PIN)).toBe(1880);
    expect(fromFlatY(1880, PIN, HERO)).toBe(3000);
    for (const flat of [900, 1500, 1880, 4000]) expect(toFlatY(fromFlatY(flat, PIN, HERO), PIN)).toBe(flat);
  });

  test("the reload case: a position stored with the pin is not shifted by the pin a second time", () => {
    const stored = toFlatY(3000, PIN); // the pagehide record
    // The page comes back without a pin: the flat position is what to scroll to.
    expect(fromFlatY(stored, null, HERO)).toBe(1880);
    // And once the pin is built, place() lands on the content the visitor left.
    expect(fromFlatY(stored, PIN, HERO)).toBe(3000);
  });

  test("inside the pin the visitor is at the hero's top; at the hero a position stays", () => {
    expect(toFlatY(0, PIN)).toBe(0);
    expect(toFlatY(600, PIN)).toBe(0);
    expect(toFlatY(1119, PIN)).toBe(0);
    expect(fromFlatY(0, PIN, HERO)).toBe(0);
    expect(fromFlatY(500, PIN, HERO)).toBe(500);
    expect(fromFlatY(800, PIN, HERO)).toBe(800);
  });

  test("a shorter pin shifts by its own length", () => {
    expect(toFlatY(1000, { ...PIN, end: 560 })).toBe(440);
  });
});
