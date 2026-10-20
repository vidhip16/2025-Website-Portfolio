import Image from "next/image";
import { contact, footer, mascot, nav, person } from "@/content/site";
import { Year } from "./Year";
import { Vitals } from "./Vitals";
import { BackToTop } from "./BackToTop";
import styles from "./footer.module.css";

type Still = { src: string; width: number; height: number };

/** Asset H6a: the mascot asleep on a keycap, curled on the outlined name. */
const SLEEPING_STILL: Still = { src: "/ping/ping-sleep.webp", width: 900, height: 614 };
/**
 * The same pose awake, shown for 400 ms by Back to top (same box as SLEEPING_STILL).
 * Lead: set to e.g. { src: "/ping/awake.webp", width: 900, height: 614 }.
 */
const AWAKE_STILL = null as Still | null;

/*
 * Where she sleeps, in em of the outlined name. Instrument Serif has ascent
 * .99 and descent .31, so line-height .82 puts the first baseline .75em below
 * the top of the name and the d and h ascenders' tops at ~.01em. Her keycap
 * rests on those ascenders and her rump over the last i, so every letter
 * stays whole. The still and the name both scale with the name's font size,
 * so this is the same spot at every width (two lines on mobile, one from lg).
 */
const SLEEP_SPOT = "left-[0.7em] top-[-0.7em] w-[1.1em]";
const SLEEP_SIZES = "(min-width: 1600px) 246px, (min-width: 1024px) 17vw, 27vw";

const linkClass = "inline-flex min-h-11 items-center font-semibold text-paper decoration-paper/60";

/** Footer (blueprint §3.6): ink room, the sleeping mascot on the outlined name. */
export function Footer() {
  const contactLinks = [
    { label: person.email, href: `mailto:${person.email}`, external: false },
    { label: contact.links.linkedin, href: person.linkedin, external: true },
    { label: contact.links.github, href: person.github, external: true },
  ];

  return (
    <footer className="on-night group relative overflow-clip bg-ink px-[var(--gutter)] pb-10 pt-20 text-paper lg:pt-28">
      {/* R1 depth: grain and night glows behind everything (footer.module.css). */}
      <div aria-hidden="true" className={`${styles.backdrop} grain`} />
      <div className={`${styles.content} mx-auto max-w-[1600px]`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-[20ch] font-display text-[clamp(2.25rem,4.6vw,3.75rem)] italic leading-[1] tracking-[-0.015em] text-moon">
            {footer.line}
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-2">
            <ul className="flex flex-wrap gap-x-5">
              {nav.map((n) => (
                <li key={n.id}>
                  <a className={linkClass} href={`/${n.href}`}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-5">
              {contactLinks.map((l) => (
                <li key={l.href}>
                  <a
                    className={`${linkClass} [overflow-wrap:anywhere]`}
                    href={l.href}
                    rel={l.external ? "noopener noreferrer" : undefined}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The font size lives on this wrapper so the still, and the room she
            needs above the name (0.8em > her 0.7em rise), are in em of the name. */}
        <div className="relative mt-[max(4.5rem,0.8em)] text-[24vw] lg:text-[15vw] 2xl:text-[14rem]">
          {/* The outlined name is a picture of the copyright line below. */}
          <p
            aria-hidden="true"
            className={[
              "select-none font-display leading-[0.82] tracking-[-0.035em] text-transparent",
              "[-webkit-text-stroke:1.5px_var(--paper)] forced-colors:text-[CanvasText]",
            ].join(" ")}
          >
            <span className="block lg:inline">{person.firstName}</span>{" "}
            <span className="block italic lg:inline">{person.lastName}</span>
          </p>
          <div className={`pointer-events-none absolute ${SLEEP_SPOT}`}>
            <Image
              src={SLEEPING_STILL.src}
              width={SLEEPING_STILL.width}
              height={SLEEPING_STILL.height}
              alt={mascot.sleepingAlt}
              sizes={SLEEP_SIZES}
              className="h-auto w-full drop-shadow-[0_0.02em_0.1em_rgb(183_163_240/0.28)] group-data-[awake]:opacity-0"
            />
            {AWAKE_STILL && (
              <Image
                src={AWAKE_STILL.src}
                width={AWAKE_STILL.width}
                height={AWAKE_STILL.height}
                alt=""
                sizes={SLEEP_SIZES}
                data-still-awake=""
                className="absolute inset-0 h-full w-full object-contain opacity-0 group-data-[awake]:opacity-100"
              />
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-4 text-base">
          <p>
            © <Year /> {person.name}
          </p>
          <Vitals prefix={footer.vitalsPrefix} inpPrefix={footer.vitalsInpPrefix} className="flex-1 basis-64" />
          <BackToTop label={mascot.backToTop} />
        </div>
      </div>
    </footer>
  );
}
