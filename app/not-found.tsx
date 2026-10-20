import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { mascot, notFound, person } from "@/content/site";

type Still = { src: string; width: number; height: number };

/**
 * Asset H6b: the mascot holding an empty picture frame. Not generated yet, so
 * an empty frame stands in. Lead: set to e.g. { src: "/ping/lost.webp", width: 800, height: 1000 }.
 */
const LOST_STILL = null as Still | null;

export const metadata: Metadata = {
  // The heading minus its full stop; a dedicated notFound.title is a sharedRequest.
  title: `${notFound.heading.replace(/\.$/, "")} | ${person.name}`,
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
          <h1 className="mt-6 max-w-[18ch] text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.02em]">
            {notFound.heading}
          </h1>
          <p className="mt-10">
            <Link href="/" className="btn btn-primary">
              {notFound.back}
            </Link>
          </p>
        </div>

        <div className="w-[min(62vw,300px)] justify-self-start md:w-[min(28vw,340px)] md:justify-self-end">
          {LOST_STILL ? (
            <Image
              src={LOST_STILL.src}
              width={LOST_STILL.width}
              height={LOST_STILL.height}
              alt={mascot.lostAlt}
              sizes="(min-width: 768px) 28vw, 62vw"
              preload
              className="h-auto w-full"
            />
          ) : (
            // Placeholder: an empty print hanging slightly askew on the wall.
            <div aria-hidden="true" className="rotate-[2.5deg] rounded-[4px] border-2 border-ink bg-white/60 p-3.5">
              <div className="aspect-[4/5] rounded-[2px] border-2 border-dashed border-lilac bg-paper" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
