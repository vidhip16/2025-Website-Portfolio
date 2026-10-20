"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { mascot } from "@/content/site";
import type { GazeData } from "@/lib/gaze";
import { afterLoad, afterLoadIdle } from "@/lib/idle";
import type { GazeHandle } from "./gaze/engine";
import { LookAround, type LookAroundState } from "./LookAround";
import { SpeechBubble } from "./SpeechBubble";

/**
 * Ping's eyes (Phase 4, procedural gaze, DECISIONS 21). Rendered by PingFigure
 * inside `span.ping-squash`, after the body image. It owns `canvas.eyes`
 * (absolutely placed at `data.strip` %), the SpeechBubble and the lazy gaze
 * engine. It finds its siblings through the DOM: `closest("figure.ping")` for
 * the figure, and `figure.querySelector("button.ping-boop")` for boops. On
 * touch screens it also portals the LookAround toggle into the figure (after
 * the boop overlay, so the overlay doesn't cover it). If motion access is
 * denied, the toggle stays mounted (disabled) until the user moves on, so the
 * element they activated is never removed while they are on it. No other props.
 *
 * First load stays tiny: GSAP, the ticker, lib/scroll and the engine arrive
 * with import("./gaze/engine") after `load` (desktop) or load + idle (touch).
 * Until the engine has decoded its sprites, the canvas is empty and the eyes
 * baked into ping-body.png show (that is also the no-JS state). Every effect
 * cleans up fully, so a hidden <Activity> stops the loop and resumes cleanly.
 */
export type PingGazeProps = {
  data: GazeData;
};

const TOUCH_MQ = "(hover: none)";
const BUBBLE_MS = 1200;

let touchMql: MediaQueryList | null = null;
const touchQuery = () => (touchMql ??= window.matchMedia(TOUCH_MQ));
const subscribeTouch = (onChange: () => void) => {
  const mq = touchQuery();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
/** LookAround shows only on touch screens that have an orientation sensor API. */
const canLookAround = () => touchQuery().matches && "DeviceOrientationEvent" in window;
const onServer = () => false;

export function PingGaze({ data }: PingGazeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<GazeHandle | null>(null);
  const gyroOnRef = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [gyro, setGyro] = useState<LookAroundState>("off");
  const [lookGone, setLookGone] = useState(false);
  const dismissLook = useCallback(() => setLookGone(true), []);
  const touch = useSyncExternalStore(subscribeTouch, canLookAround, onServer);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const figure = canvas.closest<HTMLElement>("figure.ping");
    const bubble = bubbleRef.current;
    const live = liveRef.current;
    let handle: GazeHandle | null = null;
    let cancelled = false;
    let hideTimer = 0;

    // Un-hiding the bubble text after load fetches Departure Mono off the LCP path.
    const arm = () => bubble?.setAttribute("data-armed", "");

    const boot = () => {
      arm();
      setHost(figure);
      import("./gaze/engine").then(
        ({ startGaze }) => {
          if (cancelled) return;
          handle = startGaze(canvas, data);
          handle.setGyro(gyroOnRef.current);
          engineRef.current = handle;
        },
        () => {
          /* chunk failed: the still keeps its baked eyes */
        },
      );
    };
    const offBoot = window.matchMedia(TOUCH_MQ).matches ? afterLoadIdle(boot) : afterLoad(boot);

    // Boop: click, Enter or Space on the overlay button (native button activation).
    const hide = () => {
      bubble?.setAttribute("data-show", "false");
      if (live) live.textContent = "";
    };
    const onBoop = () => {
      handle?.boop();
      arm();
      bubble?.setAttribute("data-show", "true");
      if (live) live.textContent = mascot.boopLine;
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, BUBBLE_MS);
    };
    const boopButton = figure?.querySelector<HTMLButtonElement>("button.ping-boop") ?? null;
    boopButton?.addEventListener("click", onBoop);

    return () => {
      cancelled = true;
      offBoot();
      boopButton?.removeEventListener("click", onBoop);
      window.clearTimeout(hideTimer);
      hide();
      handle?.dispose();
      if (engineRef.current === handle) engineRef.current = null;
    };
  }, [data]);

  const onLookAround = (state: LookAroundState) => {
    setGyro(state);
    gyroOnRef.current = state === "on";
    engineRef.current?.setGyro(state === "on");
  };

  const s = data.strip;
  return (
    <>
      <canvas
        ref={canvasRef}
        className="eyes pointer-events-none absolute"
        aria-hidden="true"
        style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
      />
      <SpeechBubble ref={bubbleRef} liveRef={liveRef} text={mascot.boopLine} />
      {touch && host && !lookGone
        ? createPortal(<LookAround state={gyro} onChange={onLookAround} onDismiss={dismissLook} />, host)
        : null}
    </>
  );
}
