import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/content/projects";
import styles from "./work.module.css";

/**
 * "View as list" (§6.5): six cards with cover, title, description and link.
 * Always in the HTML; CSS shows it instead of the mosaic when the toggle is
 * pressed, under reduced motion, or below 360 px (unless the visitor chose
 * the mosaic).
 */
export function ListView({ projects }: { projects: readonly Project[] }) {
  return (
    <ul data-list-view className={styles.list}>
      {projects.map((p) => (
        <li key={p.slug} className={styles.card}>
          <div className={styles.cardMedia}>
            <Image
              src={p.cover.src}
              alt={p.cover.alt}
              fill
              sizes="(max-width:640px) 92vw, (max-width:1024px) 46vw, 28vw"
            />
          </div>
          <h3 className={styles.cardTitle}>
            <Link href={`/work/${p.slug}`} className={styles.cardLink}>
              {p.title}
            </Link>
          </h3>
          <p className={styles.cardText}>{p.description}</p>
        </li>
      ))}
    </ul>
  );
}
