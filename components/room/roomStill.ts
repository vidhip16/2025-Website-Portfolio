// The room without ambient motion (reduced motion or Pause): no GSAP and no ScrollTrigger at all.
// One IntersectionObserver watches a line across the middle of the viewport; whenever a chapter, the
// room or #contact crosses it, the state is re-read from the layout and applied as hard cuts:
//   a chapter on the line → stage.dots.shape = that chapter's shape (an integer, so StaticDots shows
//                           its halftone), opacity 1, body on night (moon on night, lilac focus ring)
//   #contact on the line  → shape 5 (or 1 after a sent message) at [data-dots-anchor="contact"],
//                           desktop only (the anchor is display:none on phones, where F's sticker is)
//   between the two       → opacity 0, body back on paper
//   above the room        → the hero's: the room releases the body and stops writing
// "contact:success" cuts straight to shape 1 with mascot.boopLine in the bubble.
// Dependency-free (RoomScroll imports it statically). Cleanup undoes every write and is safe to re-run.
import {
  getAnchor,
  paintBody,
  releaseBody,
  releaseBubble,
  setAnchor,
  setBubble,
  setNight,
  token,
  writeDots,
} from "./roomStage";
import { BOOP_HOLD_MS, CONTACT_SHAPE, SEAT_SHAPE, visible } from "./roomShared";

type Zone = "above" | "chapter" | "between" | "contact";

export function startRoomStill(room: HTMLElement, boopLine: string): () => void {
  const chapters = Array.from(room.querySelectorAll<HTMLElement>("[data-chapter]"));
  const contact = document.getElementById("contact");
  const anchor = document.querySelector<HTMLElement>('[data-dots-anchor="contact"]');
  if (!chapters.length) return () => {};

  let sent = false;
  let zone: Zone | null = null;
  let shape = -1;
  let boopTimer = 0;

  const night = (on: boolean) => {
    if (on) {
      paintBody(token("--night"), token("--moon"));
      setNight(true);
    } else {
      releaseBody();
    }
  };

  const update = () => {
    const mid = window.innerHeight / 2;
    const hit = chapters.find((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
    const roomTop = room.getBoundingClientRect().top;
    const c = contact?.getBoundingClientRect();
    const inContact = !!c && c.top <= mid && c.bottom > mid && !!anchor && visible(anchor);
    const next: Zone = hit ? "chapter" : inContact ? "contact" : roomTop > mid ? "above" : "between";
    const nextShape = hit ? Number(hit.dataset.shape) || SEAT_SHAPE : inContact ? (sent ? SEAT_SHAPE : CONTACT_SHAPE) : shape;
    if (next === zone && nextShape === shape) return;
    const prev = zone;
    zone = next;
    shape = nextShape;

    if (next === "above") {
      // The hero's territory: give the body back, leave the hero's end state (Ping seated, opaque)
      // on the stage, then stop writing. On the first run there is nothing to undo.
      night(false);
      releaseBubble(boopLine);
      if (getAnchor() !== "room") setAnchor("room");
      if (prev !== null) writeDots({ shape: SEAT_SHAPE, opacity: 1, stream: 0 });
      return;
    }
    night(next === "chapter");
    // The boop line belongs beside the envelope; never let it follow the dots back to the room box.
    if (next !== "contact") releaseBubble(boopLine);
    setAnchor(next === "contact" ? "contact" : "room");
    writeDots(
      next === "between"
        ? { opacity: 0, disperse: 0, stream: 0 }
        : { shape, opacity: 1, disperse: 0, glow: next === "chapter" ? 1 : 0, stream: 0 },
    );
  };

  const onSent = () => {
    sent = true;
    zone = null; // force a re-apply
    update();
    if (getAnchor() === "contact") {
      setBubble(boopLine);
      window.clearTimeout(boopTimer);
      boopTimer = window.setTimeout(() => releaseBubble(boopLine), BOOP_HOLD_MS);
    }
  };

  // A thin band across the middle of the viewport: every crossing is a callback, and update() re-reads
  // the layout itself, so a jump that skips chapters still lands on the right one.
  const io = new IntersectionObserver(update, { rootMargin: "-50% 0px -49% 0px", threshold: 0 });
  chapters.forEach((el) => io.observe(el));
  io.observe(room);
  if (contact) io.observe(contact);
  window.addEventListener("contact:success", onSent);
  window.addEventListener("resize", update, { passive: true });
  update();

  return () => {
    io.disconnect();
    window.removeEventListener("contact:success", onSent);
    window.removeEventListener("resize", update);
    window.clearTimeout(boopTimer);
    releaseBubble(boopLine);
    releaseBody();
    if (getAnchor() !== "room") setAnchor("room");
  };
}
