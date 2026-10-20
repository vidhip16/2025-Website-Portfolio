import { about, work } from "@/content/site";
import { getProjects } from "@/content/projects";
import { MotionToggle } from "@/components/shell/MotionToggle";
import { workCopy } from "./copy";
import { buildMosaic } from "./layout";
import { ListView } from "./ListView";
import { Mosaic } from "./Mosaic";
import { ProjectIndex } from "./ProjectIndex";
import { ViewToggle } from "./ViewToggle";
import { WorkClient } from "./WorkClient";
import styles from "./work.module.css";

/**
 * #work (§3.3, §6): headline, intro, the plain project index and the view
 * controls on the left; the moving mosaic (or the list view) on the right.
 * Server component. Only verified projects reach the client islands.
 */
export function Work() {
  const projects = getProjects();
  const columns = buildMosaic(projects, about.photo);

  return (
    <section id="work" aria-labelledby="work-title" className={styles.section}>
      {/* Keeps old #projects links working. */}
      <span id="projects" className="absolute top-0" />
      <div className={styles.intro}>
        <h2 id="work-title" className={styles.heading}>
          {work.heading}
        </h2>
        <p className={styles.lede}>{work.intro}</p>
        <ProjectIndex projects={projects} />
        <div className={styles.controls}>
          <ViewToggle label={work.listToggle} />
          <MotionToggle className="border-2 border-ink px-4 text-ink" />
        </div>
      </div>
      <div className={styles.stage}>
        <Mosaic columns={columns} viewLabel={workCopy.viewBubble} />
        <ListView projects={projects} />
      </div>
      <WorkClient slugs={projects.map((p) => p.slug)} />
    </section>
  );
}
