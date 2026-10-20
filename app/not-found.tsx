import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { mascot, notFound, person } from "@/content/site";

type Still = { src: string; width: number; height: number };

/** Asset H6b: the mascot holding an empty picture frame. */
const LOST_STILL: Still = { src: "/ping/ping-404.webp", width: 563, height: 900 };

export const metadata: Metadata = {
  title: `${notFound.title} | ${person.name}`,
  robots: { index: false, follow: true },
};

/** 404 (blueprint §3.6): "404" in Departure Mono, the heading and one way home. */
export default function NotFound() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-[100svh] items-center px-[var(--gutter)] pb-16 pt-[calc(var(--nav-h)+3rem)]"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
        <div>
          <p className="font-mono text-[clamp(5.5rem,20vw,13rem)] leading-[0.85] tracking-[-0.02em]">404</p>
          <h1 className="mt-6 max-w-[18ch] text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]">
            {notFound.heading}
          </h1>
          <p className="mt-10">
            <Link href="/" className="btn btn-primary">
              {notFound.back}
            </Link>
          </p>
        </div>

        <div className="relative w-[min(52vw,240px)] justify-self-center md:w-[min(26vw,320px)] md:justify-self-end">
          {/* Depth: a soft lilac glow on the wall behind her. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[-20%] inset-y-[-6%] rounded-full bg-[radial-gradient(closest-side,rgb(183_163_240/0.42),rgb(183_163_240/0))] forced-colors:hidden"
          />
          <Image
            src={LOST_STILL.src}
            width={LOST_STILL.width}
            height={LOST_STILL.height}
            alt={mascot.lostAlt}
            sizes="(min-width: 1231px) 320px, (min-width: 768px) 26vw, (min-width: 462px) 240px, 52vw"
            preload
            className="relative h-auto w-full drop-shadow-[0_18px_22px_rgb(35_22_46/0.16)]"
          />
        </div>
      </div>
    </main>
  );
}
