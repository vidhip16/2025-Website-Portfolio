import type { Column } from "./layout";
import { MosaicColumn } from "./MosaicColumn";
import styles from "./work.module.css";

/**
 * The moving wall (§6.1–6.3), server-rendered. Motion is a CSS loop per
 * column; the lazy controller (mosaicMotion.ts) couples it to scroll, hover,
 * Pause motion and visibility. Without JS the wall still loops (or sits still
 * under reduced motion) and every tile is a plain link.
 */
export function Mosaic({ columns, viewLabel }: { columns: Column[]; viewLabel: string }) {
  return (
    <div className={styles.mosaicWrap}>
      <div data-mosaic className={styles.mosaic}>
        {columns.map((column, i) => (
          <MosaicColumn key={i} column={column} index={i} />
        ))}
      </div>
      <div data-view-bubble className={styles.bubble} aria-hidden="true">
        {viewLabel}
      </div>
    </div>
  );
}
