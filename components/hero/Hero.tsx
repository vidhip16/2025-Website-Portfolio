import { hero, mascot, onlyVerified, person } from "@/content/site";

// Phase 1 stub: server copy only. Phase 4 adds Ping, the gaze and the layer stack.
export function Hero() {
  const intro = onlyVerified(hero.intro);
  return (
    <section id="home" aria-labelledby="hero-name" className="relative isolate min-h-[100svh] overflow-clip px-[var(--gutter)] pt-[calc(var(--nav-h)+2rem)]">
      <div className="relative z-[5] max-w-[34ch] space-y-4">
        {intro.map((l) => (
          <p key={l.text}>{l.text}</p>
        ))}
        {hero.status.verified && <p className="text-base">{hero.status.text}</p>}
        <p className="flex flex-wrap gap-3">
          {hero.ctas.map((c, i) => (
            <a key={c.href} href={c.href} className={i === 0 ? "btn btn-primary" : "btn"}>
              {c.label}
            </a>
          ))}
        </p>
        <p className="font-display text-base">{mascot.wallLabel}</p>
      </div>
      <h1 id="hero-name" className="font-display text-[clamp(5.5rem,21vw,22rem)] font-extrabold leading-[0.8] tracking-[-0.035em]">
        <span className="block">{person.firstName}</span>
        <span className="name-patel block">{person.lastName}</span>
      </h1>
    </section>
  );
}
