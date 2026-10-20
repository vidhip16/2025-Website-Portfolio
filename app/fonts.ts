import localFont from "next/font/local";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";

// Revision R1 type system (DECISIONS 25). All SIL OFL 1.1, self-hosted by next/font.
// Display: Instrument Serif, roman + italic (the italic sets "Patel"). The only
// preloaded fonts, because the h1 is set in them.
export const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-serif",
});

// Body, UI and subtitles.
export const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
  variable: "--font-sans-face",
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
