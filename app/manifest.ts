import type { MetadataRoute } from "next";
import { person, seo } from "@/content/site";

/** Paper (#F6F1FA), the page background and theme colour (blueprint §1.3, §1.5). */
const PAPER = "#F6F1FA";

/**
 * Served at /manifest.webmanifest; Next links it from <head> automatically.
 * The three PNGs are exported from app/icon.svg by scripts/make_icons.py in
 * Phase 6 (the maskable one keeps 20% safe padding).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: person.name,
    short_name: person.firstName,
    description: seo.description,
    lang: "en-CA",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
