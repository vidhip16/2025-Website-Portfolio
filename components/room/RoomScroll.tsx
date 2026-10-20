"use client";

import { useEffect } from "react";
import { afterLoadIdle } from "@/lib/idle";
import { useMotionPrefs } from "@/lib/motion";
import { stage } from "@/lib/stage";
import { startRoomStill } from "./roomStill";

type Controller = typeof import("./roomMotion");

/** Kept once loaded, so Play after Pause or a re-shown route (Activity) starts at once. */
let controller: Controller | null = null;

/**
 * The room's first-load island (renders nothing).
 * - Always: stage.roomInView from an IntersectionObserver on #about.
 * - Ambient motion allowed: after load + idle, import() the scroll controller (roomMotion.ts: GSAP +
 *   ScrollTrigger, never in first-load JS). If the chunk fails, the still controller takes over.
 * - Reduced motion or Pause: the still controller (roomStill.ts): no GSAP, no ScrollTrigger, hard
 *   cuts per chapter from an IntersectionObserver.
 * Re-runs when the motion prefs flip; each cleanup undoes every write, so the swap is clean.
 */
export function RoomScroll({ boopLine }: { boopLine: string }) {
  const { ok } = useMotionPrefs();

  useEffect(() => {
    const room = document.getElementById("about");
    if (!room) return;
    const io = new IntersectionObserver(([entry]) => stage.set({ roomInView: !!entry?.isIntersecting }));
    io.observe(room);
    return () => {
      io.disconnect();
      stage.set({ roomInView: false });
    };
  }, []);

  useEffect(() => {
    const room = document.getElementById("about");
    if (!room) return;
    if (!ok) return startRoomStill(room, boopLine);

    let stop: (() => void) | undefined;
    let cancelled = false;
    let off = () => {};
    if (controller) {
      stop = controller.startRoomMotion(room, boopLine);
    } else {
      off = afterLoadIdle(() => {
        import("./roomMotion")
          .then((m) => {
            controller = m;
            if (!cancelled) stop = m.startRoomMotion(room, boopLine);
          })
          .catch(() => {
            // Chunk failed to load: hard cuts still give every chapter its shape and the night.
            if (!cancelled) stop = startRoomStill(room, boopLine);
          });
      });
    }
    return () => {
      cancelled = true;
      off();
      stop?.();
    };
  }, [ok, boopLine]);

  return null;
}
