// Unit tests for the gallery scroll memory (blueprint §6.3/§6.4). Project "unit": pure Node.
// window, document and sessionStorage are small fakes, so the pin geometry can be set per case.
import { expect, test } from "@playwright/test";
import { hasRememberedScroll, rememberScroll, requestRestore, takeRestore } from "../../components/work/scrollMemory";

/** Matches heroScrollMotion: the pin adds PIN × viewport height above everything after the hero. */
const VIEWPORT = 800;
const PIN = 1.4 * VIEWPORT;
const HERO = VIEWPORT;

type Geometry = { scrollY: number; workTop: number | null };

function install(geometry: Geometry, store: Map<string, string> = new Map()) {
  const g = globalThis as Record<string, unknown>;
  g.window = {
    get scrollY() {
      return geometry.scrollY;
    },
  };
  g.document = {
    getElementById: (id: string) =>
      id === "work" && geometry.workTop !== null
        ? { getBoundingClientRect: () => ({ top: geometry.workTop! - geometry.scrollY }) }
        : null,
  };
  g.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return store;
}

test.afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.document;
  delete g.sessionStorage;
});

test.describe("scroll memory", () => {
  test("restores into a document that has no hero pin yet (the pin is added later)", () => {
    // Opened a tile 300 px into #work with the pin active: #work's top is HERO + PIN down the page.
    const pinned: Geometry = { scrollY: HERO + PIN + 300, workTop: HERO + PIN };
    const store = install(pinned);
    rememberScroll();
    expect(hasRememberedScroll()).toBe(true);

    // A fresh document: the hero controller has not loaded, so #work sits right below the hero.
    install({ scrollY: 0, workTop: HERO }, store);
    requestRestore();
    const y = takeRestore();
    expect(y).toBe(HERO + 300);

    // heroScrollMotion.place(): a position past the hero gains the pin length once the pin exists.
    const placed = y! > HERO ? y! + PIN : y!;
    expect(placed).toBe(pinned.scrollY);
  });

  test("restores the same Y when the pin is already there (the re-shown route)", () => {
    const pinned: Geometry = { scrollY: HERO + PIN + 300, workTop: HERO + PIN };
    const store = install(pinned);
    rememberScroll();

    install({ scrollY: 0, workTop: HERO + PIN }, store);
    requestRestore();
    expect(takeRestore()).toBe(pinned.scrollY);
  });

  test("keeps a negative offset (the viewport top above #work) and never goes below zero", () => {
    const store = install({ scrollY: 150, workTop: 400 });
    rememberScroll();
    install({ scrollY: 0, workTop: 400 }, store);
    requestRestore();
    expect(takeRestore()).toBe(150);

    install({ scrollY: 0, workTop: 100 }, store);
    store.set("vp:work-offset", "-500");
    requestRestore();
    expect(takeRestore()).toBe(0);
  });

  test("restores once, and only after a request", () => {
    const store = install({ scrollY: 900, workTop: 600 });
    rememberScroll();
    expect(takeRestore()).toBeNull();
    requestRestore();
    expect(takeRestore()).toBe(900);
    expect(takeRestore()).toBeNull();
    expect(store.has("vp:work-restore")).toBe(false);
  });

  test("stores nothing when #work is missing, and ignores a corrupt value", () => {
    const store = install({ scrollY: 900, workTop: null });
    rememberScroll();
    expect(hasRememberedScroll()).toBe(false);

    install({ scrollY: 0, workTop: 600 }, store);
    store.set("vp:work-offset", "not-a-number");
    requestRestore();
    expect(takeRestore()).toBeNull();
  });

  test("blocked storage never throws", () => {
    install({ scrollY: 900, workTop: 600 });
    (globalThis as Record<string, unknown>).sessionStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => rememberScroll()).not.toThrow();
    expect(hasRememberedScroll()).toBe(false);
    expect(() => requestRestore()).not.toThrow();
    expect(takeRestore()).toBeNull();
  });
});
