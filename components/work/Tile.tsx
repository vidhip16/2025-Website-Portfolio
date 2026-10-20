import Image from "next/image";
import { ViewTransition, type CSSProperties } from "react";
import type { Cell } from "./layout";
import { PeekPing } from "./PeekPing";
import { MORPH_SHARE, morphName } from "./transition";
import styles from "./work.module.css";

const SIZES = "(max-width:1024px) 45vw, 20vw";

type Art = { src: string; width: number; height: number };

/** Mascot sticker art for the solid tiles (H7), die-cut, all 512 px tall. */
export const STICKER_ART: readonly Art[] = [
  { src: "/ping/stickers/wave.webp", width: 355, height: 512 },
  { src: "/ping/stickers/heart.webp", width: 348, height: 512 },
  { src: "/ping/stickers/thinking.webp", width: 324, height: 512 },
  { src: "/ping/stickers/surprised.webp", width: 338, height: 512 },
];
/** A sticker is 54% of a tile wide (see .sticker img in work.module.css). */
const STICKER_SIZES = "(min-width: 1600px) 9vw, (min-width: 1024px) 11vw, 26vw";

const STICKER_TILT = ["-7deg", "5deg", "-3deg", "8deg"];
const TAG_TILT = ["-4deg", "2.5deg", "-1.5deg"];

type Props = {
  cell: Cell;
  /** true for the second (aria-hidden) copy of a track. */
  clone: boolean;
};

/**
 * One mosaic cell. Covers and prints link to their project; solid tiles and
 * the headshot are decorative. Only the cover in the first copy is canonical:
 * it is focusable, carries `data-canonical`, and is the one element per
 * project wrapped in the morph ViewTransition (never added at click time).
 */
export function Tile({ cell, clone }: Props) {
  if (cell.kind === "cover" || cell.kind === "print") {
    const { project } = cell;
    const canonical = cell.kind === "cover" && !clone;
    const image = cell.kind === "cover" ? project.cover : cell.image;
    const media = (
      <div className={styles.media}>
        <Image src={image.src} alt="" fill sizes={SIZES} />
      </div>
    );
    return (
      <a
        href={`/work/${project.slug}`}
        className={styles.cell}
        data-tile=""
        data-kind={cell.kind}
        data-slug={project.slug}
        data-canonical={canonical ? "" : undefined}
        // Keyboard path: the index, then the canonical covers. Prints repeat a
        // cover's link, so they stay clickable but out of the tab order and
        // the accessibility tree, like the clones.
        tabIndex={canonical ? undefined : -1}
        aria-hidden={!clone && cell.kind === "print" ? true : undefined}
      >
        {canonical ? (
          <ViewTransition name={morphName(project.slug)} share={MORPH_SHARE} default="none">
            {media}
          </ViewTransition>
        ) : (
          media
        )}
        <span className={styles.caption}>
          <span className={styles.capTitle}>{project.title}</span>
          <span className={styles.capTags} aria-hidden="true">
            {project.tags.slice(0, 3).join(", ")}
          </span>
        </span>
      </a>
    );
  }

  if (cell.kind === "headshot") {
    return (
      <div className={styles.cell} aria-hidden={clone ? undefined : true}>
        <div className={styles.media}>
          <Image src={cell.image.src} alt="" fill sizes="15vw" />
        </div>
      </div>
    );
  }

  const { tone, thing } = cell;
  return (
    <div className={`${styles.cell} ${styles[tone]} grain grain-strong`} aria-hidden={clone ? undefined : true}>
      {thing.type === "tags" && (
        <ul className={styles.tags}>
          {thing.tags.map((t, i) => (
            <li key={t} style={{ "--tilt": TAG_TILT[i % TAG_TILT.length] } as CSSProperties}>
              {t}
            </li>
          ))}
        </ul>
      )}
      {thing.type === "sticker" && <Sticker index={thing.index} />}
      {thing.type === "peek" && <PeekPing />}
    </div>
  );
}

/** Decorative: solid tiles are aria-hidden, so the sticker has an empty alt. */
function Sticker({ index }: { index: number }) {
  const art = STICKER_ART[index % STICKER_ART.length];
  const style = { "--tilt": STICKER_TILT[index % STICKER_TILT.length] } as CSSProperties;
  return (
    <div className={styles.sticker} style={style}>
      <Image src={art.src} width={art.width} height={art.height} alt="" sizes={STICKER_SIZES} />
    </div>
  );
}
