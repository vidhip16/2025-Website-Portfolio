import Image from "next/image";
import { about, chapters, onlyVerified } from "@/content/site";
import { getProjects } from "@/content/projects";

// Phase 1 stub: server copy only. Phase 5 adds the dot stage, chips and bubbles.
export function ProjectionRoom() {
  const projects = getProjects();
  const titleOf = (slug?: string) => projects.find((p) => p.slug === slug)?.title;
  return (
    <section id="about" aria-labelledby="about-title" className="px-[var(--gutter)] py-24">
      {chapters.map((ch) => (
        <div key={ch.id} id={ch.id === "about" ? undefined : `chapter-${ch.id}`} className="max-w-[68ch] py-12">
          {ch.id === "about" ? (
            <>
              <h2 id="about-title" className="text-5xl">{about.heading}</h2>
              {onlyVerified(about.bio).map((l) => (
                <p key={l.text} className="mt-4">{l.text}</p>
              ))}
              <figure className="mt-8 w-[min(320px,80vw)] -rotate-2 border-[10px] border-paper bg-paper shadow-lg">
                <Image src={about.photo.src} width={about.photo.width} height={about.photo.height} alt={about.photo.alt} sizes="320px" />
                <figcaption className="pt-2 text-sm text-ink">{about.photo.caption}</figcaption>
              </figure>
            </>
          ) : (
            <>
              <h3 className="text-4xl">{ch.title}</h3>
              {ch.lede?.verified && <p className="mt-3">{ch.lede.text}</p>}
              <ul className="mt-4 flex flex-wrap gap-2">
                {onlyVerified(ch.skills).map((s) => (
                  <li key={s.name} className="rounded-full border-2 border-current px-3 py-1 text-base">
                    {s.name}
                    {titleOf(s.project) && <span className="sr-only-soft">, used in {titleOf(s.project)}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
