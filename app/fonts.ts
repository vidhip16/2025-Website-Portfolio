import localFont from "next/font/local";
import { Mona_Sans } from "next/font/google";

// Fraunces: static instance (SOFT 100, opsz 144, WONK 0, wght 700–800), built by
// scripts/make_fonts.py. The only preloaded font.
export const fraunces = localFont({
  src: "../public/fonts/fraunces-display.woff2",
  weight: "700 800",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
  variable: "--font-fraunces",
});

export const mona = Mona_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
  variable: "--font-mona",
});

// Departure Mono v1.500 (github.com/rektdeckard/departure-mono, OFL 1.1).
// Used only for Ping's speech bubble, the console greeting and "404".
export const departure = localFont({
  src: "../public/fonts/DepartureMono.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-departure",
});
