"use client";

import { useEffect, useRef } from "react";
import { Rotate3d } from "lucide-react";
import { mascot } from "@/content/site";

export type LookAroundState = "off" | "on" | "denied";

type OrientationPermission = { requestPermission?: () => Promise<PermissionState> };

type LookAroundProps = {
  state: LookAroundState;
  onChange: (state: LookAroundState) => void;
  /** Called once the user has moved on from a denied toggle; PingGaze then unmounts it. */
  onDismiss: () => void;
};

/**
 * Opt-in gyroscope gaze for touch screens (§4.4): a 44 px round toggle in the
 * bottom-right corner of Ping's box. iOS only grants motion access from inside
 * a user gesture, so requestPermission() is called right here in the click
 * handler; other browsers need no prompt. The accessible name comes from
 * `mascot.lookAroundLabel`, and aria-pressed carries the on/off state.
 * PingGaze renders it (touch only) and hands the result to the gaze engine.
 *
 * A denial never pulls the button out from under the user. Keyboard, Switch
 * Control and VoiceOver users may still be on it, so it stays mounted:
 * aria-disabled, unpressed and dimmed, and clicks do nothing. It asks to be
 * removed only after the user has moved on, when focus lands anywhere else
 * on the page or a press starts outside it.
 */
export function LookAround({ state, onChange, onDismiss }: LookAroundProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const asking = useRef(false);
  const denied = state === "denied";

  useEffect(() => {
    if (!denied) return;
    const away = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onDismiss();
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("focusin", away, opts);
    document.addEventListener("pointerdown", away, opts);
    return () => {
      document.removeEventListener("focusin", away, opts);
      document.removeEventListener("pointerdown", away, opts);
    };
  }, [denied, onDismiss]);

  const onClick = () => {
    if (denied || asking.current) return;
    if (state === "on") {
      onChange("off");
      return;
    }
    const api = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined;
    if (typeof api?.requestPermission !== "function") {
      onChange("on");
      return;
    }
    asking.current = true;
    api
      .requestPermission()
      .then(
        (result) => onChange(result === "granted" ? "on" : "denied"),
        () => onChange("denied"),
      )
      .finally(() => {
        asking.current = false;
      });
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={state === "on"}
      aria-disabled={denied || undefined}
      aria-label={mascot.lookAroundLabel}
      onClick={onClick}
      className={[
        "absolute bottom-0 right-0 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-full",
        "border-[1.5px] border-ink/60 bg-paper/85 text-ink shadow-[0_0.4rem_1rem_-0.6rem_rgb(35_22_46/0.5)]",
        "aria-pressed:border-ink aria-pressed:bg-lilac",
        "aria-disabled:cursor-default aria-disabled:border-ink/25 aria-disabled:text-ink/40 aria-disabled:shadow-none",
        "forced-colors:border-[ButtonText] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]",
        "forced-colors:aria-disabled:border-[GrayText] forced-colors:aria-disabled:text-[GrayText]",
      ].join(" ")}
    >
      <Rotate3d aria-hidden size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </button>
  );
}
