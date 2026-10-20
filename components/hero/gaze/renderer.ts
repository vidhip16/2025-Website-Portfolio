// Canvas renderer for the procedural gaze (PHASE4 "Gaze renderer"), behind the
// GazeRenderer contract in lib/gaze.ts.
//
// canvas.eyes covers the eyes strip (gaze.strip, % of the Ping box). Its
// backing store is the CSS size × min(dpr, 2); the draw transform maps strip
// pixels (the strip images' natural size) onto it, so every coordinate below
// is in strip px. Per frame:
//   clear → eyes-blank strip → per eye: clip to the dome ellipse (rot, r, −2%)
//   and draw that eye's pupil sprite at c + pupil.off + travel ⊙ (cosθ, sinθ) × w.
// Blink / happy draw their own strip instead. Nothing is drawn until the core
// sprites exist, so the eyes baked into ping-body.png show until then, and the
// centred frame puts the same sprites back where they were cut from: it is the
// baked eyes, pixel for pixel (up to WebP noise).
import type { GazeRenderer } from "@/lib/gaze";
import { pupilTopLeft, type Geometry } from "./geometry";
import { releaseSprite, type CoreSprites, type Sprite } from "./sprites";

export type Expression = "eyes" | "blink" | "happy";

/** Redraw only when a pupil moves more than this (backing-store px). */
const MOVE_EPS = 0.25;
const MAX_DPR = 2;

type Pose = { angle: number; weight: number };

export class CanvasGazeRenderer implements GazeRenderer {
  private ctx: CanvasRenderingContext2D | null;
  private core: CoreSprites | null = null;
  private blinkStrip: Sprite | null = null;
  private happyStrip: Sprite | null = null;
  private readonly poses: [Pose, Pose] = [
    { angle: 0, weight: 0 },
    { angle: 0, weight: 0 },
  ];
  private overlay: { kind: "blink" | "happy"; until: number } | null = null;
  /** What is on the canvas now: expression + pupil top-lefts (strip px). */
  private shown: { expr: Expression | null; px: number[] } = { expr: null, px: [] };
  private dirty = true;
  private css = { w: 0, h: 0 };
  private readonly canvas: HTMLCanvasElement;
  private readonly geo: Geometry;

  constructor(canvas: HTMLCanvasElement, geo: Geometry) {
    this.canvas = canvas;
    this.geo = geo;
    this.ctx = canvas.getContext("2d");
  }

  /** True once the blank strip and both pupils have decoded. */
  get ready(): boolean {
    return this.core !== null;
  }

  setCore(core: CoreSprites): void {
    releaseSprite(this.core?.blank);
    releaseSprite(this.core?.pupilL);
    releaseSprite(this.core?.pupilR);
    this.core = core;
    this.dirty = true;
  }

  setStrip(kind: "blink" | "happy", sprite: Sprite): void {
    if (kind === "blink") {
      releaseSprite(this.blinkStrip);
      this.blinkStrip = sprite;
    } else {
      releaseSprite(this.happyStrip);
      this.happyStrip = sprite;
    }
  }

  /** Per-eye pose (the engine converges each eye on its own angle). */
  setEyes(angleL: number, weightL: number, angleR: number, weightR: number): void {
    this.poses[0].angle = angleL;
    this.poses[0].weight = weightL;
    this.poses[1].angle = angleR;
    this.poses[1].weight = weightR;
  }

  // ── GazeRenderer ─────────────────────────────────────────────────────────
  draw(angleDeg: number, circleWeight: number): void {
    this.setEyes(angleDeg, circleWeight, angleDeg, circleWeight);
    this.frame(performance.now());
  }

  blink(ms: number): void {
    this.showOverlay("blink", ms);
  }

  happy(ms: number): void {
    this.showOverlay("happy", ms);
  }

  /**
   * Size the backing store: CSS size × min(dpr, 2). `devW/devH` come from a
   * device-pixel-content-box ResizeObserver entry when the browser has one
   * (exact device pixels); otherwise the CSS size is scaled by the dpr.
   */
  resize(cssW?: number, cssH?: number, devW?: number, devH?: number): void {
    if (cssW !== undefined && cssH !== undefined) this.css = { w: cssW, h: cssH };
    else this.css = { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
    const dpr = window.devicePixelRatio || 1;
    const exact = devW !== undefined && devH !== undefined && dpr <= MAX_DPR;
    const w = exact ? devW : Math.round(this.css.w * Math.min(dpr, MAX_DPR));
    const h = exact ? devH : Math.round(this.css.h * Math.min(dpr, MAX_DPR));
    if (w < 1 || h < 1) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; // clears the canvas: redraw in the same task, before paint
      this.canvas.height = h;
      this.dirty = true;
      this.frame(performance.now());
    }
  }

  dispose(): void {
    this.clear();
    releaseSprite(this.core?.blank);
    releaseSprite(this.core?.pupilL);
    releaseSprite(this.core?.pupilR);
    releaseSprite(this.blinkStrip);
    releaseSprite(this.happyStrip);
    this.core = this.blinkStrip = this.happyStrip = null;
    this.ctx = null;
  }

  // ── Frame ────────────────────────────────────────────────────────────────
  /** Force the next frame() to draw (e.g. the canvas came back into view). */
  invalidate(): void {
    this.dirty = true;
  }

  /** The expression showing at `now`. */
  expression(now: number): Expression {
    const o = this.overlay;
    if (!o) return "eyes";
    if (now >= o.until) {
      this.overlay = null;
      return "eyes";
    }
    if (o.kind === "blink" && this.blinkStrip) return "blink";
    if (o.kind === "happy" && this.happyStrip) return "happy";
    return "eyes";
  }

  /** Draw if anything visible changed. Returns true when it drew. */
  frame(now: number): boolean {
    const ctx = this.ctx;
    const core = this.core;
    if (!ctx || !core) return false;
    const { width: W, height: H } = this.canvas;
    const { sw, sh, eyes } = this.geo;
    const kx = W / sw;
    const ky = H / sh;
    const expr = this.expression(now);

    const px: number[] = [];
    if (expr === "eyes") {
      for (let i = 0; i < 2; i++) px.push(...pupilTopLeft(eyes[i], this.poses[i].angle, this.poses[i].weight));
    }
    if (!this.dirty && expr === this.shown.expr && (expr !== "eyes" || !moved(px, this.shown.px, kx, ky))) {
      return false;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(kx, 0, 0, ky, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (expr === "blink" && this.blinkStrip) {
      ctx.drawImage(this.blinkStrip, 0, 0, sw, sh);
    } else if (expr === "happy" && this.happyStrip) {
      ctx.drawImage(this.happyStrip, 0, 0, sw, sh);
    } else {
      ctx.drawImage(core.blank, 0, 0, sw, sh);
      for (let i = 0; i < 2; i++) {
        const e = eyes[i];
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(e.cx, e.cy, e.rx, e.ry, e.rot, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(i === 0 ? core.pupilL : core.pupilR, px[i * 2], px[i * 2 + 1], e.pw, e.ph);
        ctx.restore();
      }
    }
    this.shown = { expr, px };
    this.dirty = false;
    return true;
  }

  private showOverlay(kind: "blink" | "happy", ms: number): void {
    // A blink never cuts a happy face short.
    if (kind === "blink" && this.overlay?.kind === "happy" && performance.now() < this.overlay.until) return;
    this.overlay = { kind, until: performance.now() + ms };
  }

  private clear(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.shown = { expr: null, px: [] };
    this.dirty = true;
  }
}

/** Did any pupil move more than MOVE_EPS backing px? (`a`, `b` in strip px, x/y pairs.) */
function moved(a: number[], b: number[], kx: number, ky: number): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i += 2) {
    if (Math.abs(a[i] - b[i]) * kx > MOVE_EPS || Math.abs(a[i + 1] - b[i + 1]) * ky > MOVE_EPS) return true;
  }
  return false;
}
