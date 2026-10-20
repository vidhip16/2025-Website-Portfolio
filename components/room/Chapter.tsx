import Image from "next/image";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Chapter as ChapterData, Line } from "@/content/site";
import { SkillChip } from "./SkillChip";
import s from "./room.module.css";

/** A verified skill, resolved by ProjectionRoom: what the chip links to and what the bubble says. */
export type ChipData = { name: string; bubble?: string; slug?: string; href?: string };

export type AboutData = {
  heading: string;
  bio: Line[];
  photo: { src: string; width: number; height: number; alt: string; caption: string };
};

const ICON = { strokeWidth: 1.75, "aria-hidden": true, focusable: false } as const;

/** Print width: 17vw (190–300 px) beside the bio on desktop, min(62vw, 280px) stacked. */
const PRINT_SIZES = "(min-width: 1765px) 300px, (min-width: 1024px) 17vw, (min-width: 452px) 280px, 62vw";

/**
 * The headshot as a print taped to the wall: next/image (AVIF via next.config, lazy), rotated −2°
 * inside a 10 px plaster border, with a cast shadow and the projector's light pool behind it. The
 * caption is an R1 wall label (small italic serif under a hairline rule) on the wall below.
 */
function Print({ photo }: { photo: AboutData["photo"] }) {
  return (
    <figure className={s.print}>
      <div className={s.frame}>
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          sizes={PRINT_SIZES}
          quality={75}
          loading="lazy"
        />
      </div>
      <figcaption className={s.caption}>{photo.caption}</figcaption>
    </figure>
  );
}

/**
 * One projection-room chapter (blueprint §3.2): `[data-chapter]` (the QA hook) with `data-shape`
 * (the dot shape the room controllers show beside it), at least 90svh tall. Server-rendered and
 * complete without JavaScript; the only client code is the chips' hover/focus/click island.
 */
export function Chapter({
  chapter,
  numeral,
  chips,
  about,
}: {
  chapter: ChapterData;
  numeral: number;
  chips: ChipData[];
  about?: AboutData;
}) {
  const isAbout = chapter.id === "about";
  const Heading = isAbout ? "h2" : "h3";
  const headingId = isAbout ? "about-title" : `chapter-${chapter.id}-title`;
  const lede = chapter.lede?.verified ? chapter.lede.text : null;

  return (
    <div
      data-chapter={chapter.id}
      data-shape={chapter.shape}
      id={isAbout ? undefined : `chapter-${chapter.id}`}
      className={s.chapter}
    >
      <div className={s.copy} data-numeral={numeral}>
        <Heading id={headingId} className={s.title}>
          {about && isAbout ? about.heading : chapter.title}
        </Heading>
        {lede && <p className={s.lede}>{lede}</p>}

        {about && isAbout && (
          <div className={s.aboutBody}>
            <div className={s.bio}>
              {about.bio.map((line) => (
                <p key={line.text}>{line.text}</p>
              ))}
            </div>
            <Print photo={about.photo} />
          </div>
        )}

        {chips.length > 0 && (
          <ul className={s.chips}>
            {chips.map((chip) => (
              <li key={chip.name}>
                <SkillChip name={chip.name} bubble={chip.bubble} slug={chip.slug} href={chip.href}>
                  {chip.slug ? <ArrowDownRight {...ICON} /> : chip.href ? <ArrowUpRight {...ICON} /> : null}
                </SkillChip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
