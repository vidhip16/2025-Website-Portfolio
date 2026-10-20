// Unit tests for lib/heroPin: positions kept "flat" (as if the hero's desktop pin were not in the
// page). Project "unit": Node only. These are the reload and "Back to the gallery" cases of the
// round-1 finding hero-pin-restore-double-offset.
import { expect, test } from "@playwright/test";
import { fromFlatY, registerHeroPin, toFlatY } from "../../lib/heroPin";

// A 1280 x 800 viewport: the pin is 1.4 x 800 = 1120 px long and starts at the top.
const PIN = { start: 0, end: 1120, height: 800 };

test.describe("heroPin", () => {
  test("with no pin registered, flat and raw positions are the same number", () => {
    expect(toFlatY(3000)).toBe(3000);
    expect(fromFlatY(3000)).toBe(3000);
  });

  test("past the hero, a raw position loses the pin length and gets it back", () => {
    const off = registerHeroPin(() => PIN);
    try {
      expect(toFlatY(3000)).toBe(1880);
      expect(fromFlatY(1880)).toBe(3000);
      for (const flat of [900, 1500, 1880, 4000]) expect(toFlatY(fromFlatY(flat))).toBe(flat);
    } finally {
      off();
    }
  });

  test("the reload case: a position stored with the pin is not shifted by the pin a second time", () => {
    const offPinned = registerHeroPin(() => PIN);
    const stored = toFlatY(3000); // rememberScroll() / the pagehide record
    offPinned();
    // The page comes back without a pin: the flat position is what to scroll to.
    expect(fromFlatY(stored)).toBe(1880);
    // And once the pin is built, place() lands on the content the visitor left.
    const offAgain = registerHeroPin(() => PIN);
    try {
      expect(fromFlatY(stored)).toBe(3000);
    } finally {
      offAgain();
    }
  });

  test("inside the pin the visitor is at the hero's top; at the hero a position stays", () => {
    const off = registerHeroPin(() => PIN);
    try {
      expect(toFlatY(0)).toBe(0);
      expect(toFlatY(600)).toBe(0);
      expect(toFlatY(1119)).toBe(0);
      expect(fromFlatY(0)).toBe(0);
      expect(fromFlatY(500)).toBe(500);
      expect(fromFlatY(800)).toBe(800);
    } finally {
      off();
    }
  });

  test("a stale unregister does not drop a newer pin", () => {
    const offOld = registerHeroPin(() => PIN);
    const offNew = registerHeroPin(() => ({ ...PIN, end: 560 }));
    try {
      offOld();
      expect(toFlatY(1000)).toBe(440);
    } finally {
      offNew();
    }
    expect(toFlatY(1000)).toBe(1000);
  });

  test("a registered reader that has no pin yet (null) means no shift", () => {
    const off = registerHeroPin(() => null);
    try {
      expect(toFlatY(3000)).toBe(3000);
      expect(fromFlatY(3000)).toBe(3000);
    } finally {
      off();
    }
  });
});
