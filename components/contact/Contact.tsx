import Image from "next/image";
import { contact, person } from "@/content/site";
import { ContactForm } from "./ContactForm";

type Still = { src: string; width: number; height: number };

/**
 * Mobile-only static mascot sticker (blueprint §3.5: "On mobile, a static Ping
 * sticker replaces the dots"). Asset H7 does not exist yet, so nothing renders.
 * Lead: set to e.g. { src: "/ping/sticker-wave.webp", width: 480, height: 480 }.
 */
const CONTACT_STICKER = null as Still | null;

const linkClass = "inline-flex min-h-11 items-center font-semibold";

export function Contact() {
  const f = contact.form;
  return (
    <section id="contact" aria-labelledby="contact-title" className="px-[var(--gutter)] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="flex flex-col">
          <h2 id="contact-title" className="text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.02em]">
            {contact.heading}
          </h2>
          <p className="mt-6 max-w-[34ch]">{contact.lede}</p>
          <address className="mt-8 not-italic">
            <ul className="space-y-1">
              <li>
                <a className={`${linkClass} [overflow-wrap:anywhere]`} href={`mailto:${person.email}`}>
                  {person.email}
                </a>
              </li>
              <li>
                <a className={linkClass} href={person.linkedin} rel="noopener noreferrer">
                  LinkedIn
                </a>
              </li>
              <li>
                <a className={linkClass} href={person.github} rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li className="flex min-h-11 items-center">{person.location}</li>
            </ul>
          </address>

          {/* Phase 5: the dot stage assembles the envelope (shape 5) over this rect. */}
          <div
            data-dots-anchor="contact"
            aria-hidden="true"
            className="mt-12 hidden aspect-[4/3] w-full max-w-[360px] lg:block"
          />

          {CONTACT_STICKER && (
            <Image
              src={CONTACT_STICKER.src}
              width={CONTACT_STICKER.width}
              height={CONTACT_STICKER.height}
              alt=""
              sizes="40vw"
              className="mt-10 h-auto w-[min(40vw,200px)] rotate-[-4deg] lg:hidden"
            />
          )}
        </div>

        <ContactForm copy={{ name: f.name, email: f.email, message: f.message, submit: f.submit, pending: f.pending }} />
      </div>
    </section>
  );
}
