import { work } from "@/content/site";
import { getProjects } from "@/content/projects";

// Phase 1 stub: index + list of projects. Phase 3 (E) adds the mosaic.
export function Work() {
  const projects = getProjects();
  return (
    <section id="work" aria-labelledby="work-title" className="px-[var(--gutter)] py-24">
      <span id="projects" />
      <h2 id="work-title" className="text-[clamp(3rem,6vw,6.5rem)] leading-none">{work.heading}</h2>
      <p className="mt-4 max-w-[68ch]">{work.intro}</p>
      <ol className="mt-10 grid gap-8 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.slug}>
            <h3 className="text-3xl">
              <a href={`/work/${p.slug}`}>{p.title}</a>
            </h3>
            <p className="mt-2">{p.description}</p>
            <p className="mt-2 text-base">{p.tags.join(", ")}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
