import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { person } from "@/content/site";
import { getProject, getProjects } from "@/content/projects";
import { Footer } from "@/components/footer/Footer";
import { BackLink } from "@/components/work/BackLink";
import { workUi } from "@/components/work/copy";
import { MORPH_SHARE, morphName } from "@/components/work/transition";

type Props = { params: Promise<{ slug: string }> };

// The hero must commit together with the navigation for the cover → hero
// morph to pair, so params are awaited outside <Suspense>. That blocks the
// shell for unknown slugs (they 404), so this route opts out of the
// static-shell check. Every real slug is fully prerendered below.
export const instant = false;

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  const url = `/work/${project.slug}`;
  const title = `${project.title} | ${person.name}`;
  return {
    title,
    description: project.description,
    alternates: { canonical: url },
    // og:image comes from ./opengraph-image.tsx (cover + title), never the cover file.
    openGraph: {
      type: "article",
      url,
      siteName: person.name,
      locale: "en_CA",
      title,
      description: project.description,
      authors: [person.name],
    },
    twitter: { card: "summary_large_image", title, description: project.description },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const all = getProjects();
  const at = all.findIndex((p) => p.slug === project.slug);
  const prev = all[(at - 1 + all.length) % all.length];
  const next = all[(at + 1) % all.length];

  return (
    <>
      <main
        id="main"
        tabIndex={-1}
        className="px-[var(--gutter)] pb-[clamp(72px,10vw,128px)] pt-[calc(var(--nav-h)+clamp(20px,4vh,48px))]"
      >
        <article aria-labelledby="project-title" className="mx-auto max-w-[1320px]">
          <BackLink
            label={workUi.back}
            className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 font-semibold text-ink no-underline hover:underline"
          />

          <div className="mt-4 grid items-start gap-x-[clamp(32px,6vw,96px)] gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <ViewTransition name={morphName(project.slug)} share={MORPH_SHARE} default="none">
              <div
                data-detail-hero
                className="relative aspect-[4/5] w-full max-w-[560px] overflow-hidden rounded-tile bg-lilac"
              >
                <Image
                  src={project.cover.src}
                  alt={project.cover.alt}
                  fill
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width:1024px) 92vw, 40vw"
                  className="object-cover"
                />
              </div>
            </ViewTransition>

            <div className="lg:pt-[clamp(8px,4vh,48px)]">
              <h1
                id="project-title"
                className="text-[clamp(2.75rem,6.5vw,6rem)] leading-[0.92] tracking-[-0.025em]"
              >
                {project.title}
              </h1>
              <p className="mt-6 max-w-[60ch]">{project.description}</p>

              <h2 className="mt-10 font-sans text-base font-semibold">{workUi.builtWith}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <li key={tag} className="rounded-full border-2 border-ink px-3 py-1 text-base leading-tight">
                    {tag}
                  </li>
                ))}
              </ul>

              <p className="mt-10">
                <a href={project.repo} data-repo className="btn btn-primary" rel="noopener noreferrer">
                  {workUi.viewCode}
                </a>
              </p>
              {/* TODO(vidhi): problem, role, what I learned and a live demo link stay
                  hidden until Vidhi supplies them (content/projects.ts). */}
            </div>
          </div>

          {project.original && (
            <section aria-labelledby="original-title" className="mt-[clamp(72px,10vw,128px)]">
              <h2 id="original-title" className="text-[clamp(1.75rem,3vw,2.5rem)]">
                {workUi.original}
              </h2>
              <figure className="mt-8 w-[min(420px,82vw)] -rotate-2 border-[10px] border-paper bg-paper shadow-[0_18px_40px_rgb(35_22_46/0.16)]">
                <Image
                  src={project.original.src}
                  width={project.original.width}
                  height={project.original.height}
                  alt={project.original.alt}
                  sizes="420px"
                  className="h-auto w-full"
                />
              </figure>
            </section>
          )}

          <nav
            aria-label={workUi.moreProjects}
            className="mt-[clamp(72px,10vw,128px)] grid gap-4 border-t-2 border-ink pt-8 sm:grid-cols-2"
          >
            <Link
              href={`/work/${prev.slug}`}
              rel="prev"
              className="group flex min-h-11 flex-col gap-1 text-ink no-underline"
            >
              <span className="text-base">{workUi.prev}</span>
              <span className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold leading-tight group-hover:underline">
                {prev.title}
              </span>
            </Link>
            <Link
              href={`/work/${next.slug}`}
              rel="next"
              className="group flex min-h-11 flex-col gap-1 text-ink no-underline sm:items-end sm:text-right"
            >
              <span className="text-base">{workUi.next}</span>
              <span className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold leading-tight group-hover:underline">
                {next.title}
              </span>
            </Link>
          </nav>
        </article>
      </main>
      <Footer />
    </>
  );
}
