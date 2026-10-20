import { experience, onlyVerified } from "@/content/site";

const span = (s: number, e: number | null) => `${s} to ${e ?? "present"}`;

// Phase 1 stub. Phase 3 (F) adds the two-lane branch diagram.
export function Branches() {
  const roles = onlyVerified(experience.roles);
  return (
    <section id="experience" aria-labelledby="exp-title" className="px-[var(--gutter)] py-24">
      <span id="resume" />
      <h2 id="exp-title" className="text-5xl">{experience.heading}</h2>
      <ol className="mt-8 space-y-6">
        {roles.map((r) => (
          <li key={r.id}>
            <p className="font-display text-xl">{span(r.start, r.end)}</p>
            <h3 className="font-sans text-2xl font-semibold">
              {r.title}, {r.org}
            </h3>
            {r.description && <p className="mt-1 max-w-[68ch]">{r.description}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
