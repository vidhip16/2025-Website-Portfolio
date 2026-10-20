"use client";

import { Rotate3d } from "lucide-react";
import { mascot } from "@/content/site";

export type LookAroundState = "off" | "on" | "denied";

type OrientationPermission = { requestPermission?: () => Promise<PermissionState> };

/**
 * Opt-in gyroscope gaze for touch screens (§4.4): a 44 px round toggle in the
 * bottom-right corner of Ping's box. iOS only grants motion access from inside
 * a user gesture, so requestPermission() is called right here in the click
 * handler; other browsers need no prompt. The accessible name comes from
 * `mascot.lookAroundLabel`, and aria-pressed carries the on/off state.
 * PingGaze renders it (touch only) and hands the result to the gaze engine.
 */
export function LookAround({ on, onChange }: { on: boolean; onChange: (state: LookAroundState) => void }) {
  const onClick = () => {
    if (on) {
      onChange("off");
      return;
    }
    const api = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined;
    if (typeof api?.requestPermission !== "function") {
      onChange("on");
      return;
    }
    api.requestPermission().then(
      (result) => onChange(result === "granted" ? "on" : "denied"),
      () => onChange("denied"),
    );
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={mascot.lookAroundLabel}
      onClick={onClick}
      className={[
        "absolute bottom-0 right-0 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-full",
        "border-[1.5px] border-ink/60 bg-paper/85 text-ink shadow-[0_0.4rem_1rem_-0.6rem_rgb(35_22_46/0.5)]",
        "aria-pressed:border-ink aria-pressed:bg-lilac",
        "forced-colors:border-[ButtonText] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]",
      ].join(" ")}
    >
      <Rotate3d aria-hidden size={20} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </button>
  );
}
