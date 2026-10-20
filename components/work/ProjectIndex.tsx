import Link from "next/link";
import type { Project } from "@/content/projects";
import styles from "./work.module.css";

/**
 * The plain index beside the mosaic: every project, in server-rendered HTML,
 * first in the keyboard path. Hover/focus highlights the project's canonical
 * tile and pauses the wall (wired by WorkClient).
 */
export function ProjectIndex({ projects }: { projects: readonly Project[] }) {
  return (
    <ol id="work-index" className={styles.index}>
      {projects.map((p) => (
        <li key={p.slug}>
          <Link href={`/work/${p.slug}`} data-index-link={p.slug} className={styles.indexLink}>
            {p.title}
          </Link>
        </li>
      ))}
    </ol>
  );
}
