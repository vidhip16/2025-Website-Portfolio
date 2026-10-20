import Image from "next/image";
import { footer, mascot, nav, person } from "@/content/site";
import { Year } from "./Year";
import { Vitals } from "./Vitals";
import { BackToTop } from "./BackToTop";

type Still = { src: string; width: number; height: number };

/**
 * Asset H6a: the mascot asleep, curled on the outlined name. Not generated yet,
 * so nothing renders. Lead: set to e.g. { src: "/ping/sleeping.webp", width: 900, height: 560 }.
 */
const SLEEPING_STILL = null as Still | null;
/**
 * The same pose awake, shown for 400 ms by Back to top (same box as SLEEPING_STILL).
 * Lead: set to e.g. { src: "/ping/awake.webp", width: 900, height: 560 }.
 */
const AWAKE_STILL = null as Still | null;

// The global `a { color }` rule in app/globals.css is unlayered and beats
// Tailwind utilities, so footer links take their colour inline. Once those
// element rules move into `@layer base` (sharedRequest), `text-paper` on the
// links can replace this.
const onInk = { color: "var(--paper)" } as const;
const linkClass = "inline-flex min-h-11 items-center font-semibold decoration-paper/60";

/** Footer (blueprint §3.6): ink room, the sleeping mascot on the outlined name. */
export function Footer() {
  const contactLinks = [
    { label: person.email, href: `mailto:${person.email}`, external: false },
    { label: "LinkedIn", href: person.linkedin, external: true },
    { label: "GitHub", href: person.github, external: true },
  ];

  return (
    <footer className="on-night group relative overflow-clip bg-ink px-[var(--gutter)] pb-10 pt-20 text-paper lg:pt-28">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-[20ch] font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.01em]">
            {footer.line}
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-2">
            <ul className="flex flex-wrap gap-x-5">
              {nav.map((n) => (
                <li key={n.id}>
                  <a className={linkClass} style={onInk} href={`/${n.href}`}>
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
                    style={onInk}
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

        {/* The outlined name is a picture of the copyright line below. */}
        <div className="relative mt-16 lg:mt-24">
          <p
            aria-hidden="true"
            className={[
              "select-none font-display font-extrabold leading-[0.82] tracking-[-0.035em] text-transparent",
              "text-[24vw] lg:text-[15vw] 2xl:text-[14rem]",
              "[-webkit-text-stroke:1.5px_var(--paper)] forced-colors:text-[CanvasText]",
            ].join(" ")}
          >
            <span className="block lg:inline">{person.firstName}</span>{" "}
            <span className="block lg:inline">{person.lastName}</span>
          </p>
          {SLEEPING_STILL && (
            <div className="pointer-events-none absolute bottom-[38%] right-[6%] w-[clamp(140px,26vw,380px)] lg:bottom-[62%] lg:right-[10%]">
              <Image
                src={SLEEPING_STILL.src}
                width={SLEEPING_STILL.width}
                height={SLEEPING_STILL.height}
                alt={mascot.sleepingAlt}
                sizes="(min-width: 1024px) 26vw, 40vw"
                className="h-auto w-full group-data-[awake]:opacity-0"
              />
              {AWAKE_STILL && (
                <Image
                  src={AWAKE_STILL.src}
                  width={AWAKE_STILL.width}
                  height={AWAKE_STILL.height}
                  alt=""
                  sizes="(min-width: 1024px) 26vw, 40vw"
                  data-still-awake=""
                  className="absolute inset-0 h-full w-full object-contain opacity-0 group-data-[awake]:opacity-100"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-4 text-base">
          <p>
            © <Year /> {person.name}
          </p>
          <Vitals prefix={footer.vitalsPrefix} className="flex-1 basis-64" />
          <BackToTop label={mascot.backToTop} />
        </div>
      </div>
    </footer>
  );
}
