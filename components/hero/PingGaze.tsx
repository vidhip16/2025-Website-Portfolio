"use client";

import type { GazeData } from "@/lib/gaze";

/**
 * Contract stub (Phase 4). Rendered by PingFigure inside `span.ping-squash`,
 * after the body image. It owns `canvas.eyes` (absolutely placed at
 * `data.strip` %), the SpeechBubble and the lazy gaze engine. It finds its
 * siblings through the DOM: `closest("figure.ping")` for the figure, and
 * `figure.querySelector("button.ping-boop")` for boops. No other props.
 */
export type PingGazeProps = {
  data: GazeData;
};

export function PingGaze({ data }: PingGazeProps) {
  const s = data.strip;
  return (
    <canvas
      className="eyes pointer-events-none absolute"
      aria-hidden="true"
      style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
    />
  );
}
