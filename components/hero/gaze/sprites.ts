// Sprite loading for the procedural gaze. fetch → createImageBitmap so decoding
// happens off the main thread; an <img>.decode() fallback covers browsers whose
// createImageBitmap rejects the alpha WebP (blueprint §12 Safari note).
import type { GazeData } from "@/lib/gaze";

export type Sprite = ImageBitmap | HTMLImageElement;

/** The three sprites the eyes cannot be drawn without. */
export type CoreSprites = { blank: Sprite; pupilL: Sprite; pupilR: Sprite };

const aborted = () => new DOMException("Aborted", "AbortError");

async function viaImg(url: string, signal: AbortSignal): Promise<Sprite> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  if (signal.aborted) throw aborted();
  return img;
}

export async function decodeSprite(url: string, signal: AbortSignal): Promise<Sprite> {
  if (typeof createImageBitmap === "function") {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const bitmap = await createImageBitmap(await res.blob());
      if (signal.aborted) {
        bitmap.close();
        throw aborted();
      }
      return bitmap;
    } catch (err) {
      if (signal.aborted) throw err;
      // Decoder refused the blob: try the <img> path once before giving up.
    }
  }
  return viaImg(url, signal);
}

/** Blank strip + both pupils, all or nothing (until then the baked eyes show). */
export async function loadCore(s: GazeData["sprites"], signal: AbortSignal): Promise<CoreSprites> {
  const settled = await Promise.allSettled([
    decodeSprite(s.blank, signal),
    decodeSprite(s.pupilL, signal),
    decodeSprite(s.pupilR, signal),
  ]);
  const ok = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length < 3) {
    ok.forEach(releaseSprite);
    const failed = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw failed?.reason ?? new Error("gaze sprites failed to load");
  }
  const [blank, pupilL, pupilR] = ok;
  return { blank, pupilL, pupilR };
}

/** Blink / happy strips: optional, so a failure only drops that expression. */
export const loadOptional = (url: string, signal: AbortSignal): Promise<Sprite | null> =>
  decodeSprite(url, signal).catch(() => null);

export function releaseSprite(s: Sprite | null | undefined): void {
  if (s && "close" in s) s.close();
}
