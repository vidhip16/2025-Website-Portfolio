import type { CSSProperties } from "react";
import type { Column } from "./layout";
import { Tile } from "./Tile";
import styles from "./work.module.css";

const VISIBILITY: Record<Column["from"], string> = {
  base: "",
  lg: styles.colLg,
  "2xl": styles.col2xl,
};

/**
 * One column: an outer wrapper (scrubbed parallax, designed offset) around a
 * track that loops its 5 cells rendered twice (A + A). The second copy is
 * aria-hidden and every link in it has tabIndex -1 (never `inert`: it would
 * block hit-testing, and half of every loop the visible tiles are clones).
 */
export function MosaicColumn({ column, index }: { column: Column; index: number }) {
  const colStyle = { "--off": `${column.offset}px` } as CSSProperties;
  const trackStyle = {
    "--dur": `${column.duration}s`,
    "--dir": column.direction === "down" ? "reverse" : "normal",
  } as CSSProperties;
  return (
    <div
      data-mosaic-col={index}
      data-parallax={column.parallax}
      className={`${styles.col} ${VISIBILITY[column.from]}`}
      style={colStyle}
    >
      <div data-track className={styles.track} style={trackStyle}>
        <div className={styles.group}>
          {column.cells.map((cell, i) => (
            <Tile key={i} cell={cell} clone={false} />
          ))}
        </div>
        <div className={styles.group} data-clone aria-hidden="true">
          {column.cells.map((cell, i) => (
            <Tile key={i} cell={cell} clone />
          ))}
        </div>
      </div>
    </div>
  );
}
