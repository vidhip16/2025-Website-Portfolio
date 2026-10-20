import gazeJson from "@/content/gaze.json";
import { hero, mascot, onlyVerified, person } from "@/content/site";
import type { GazeData } from "@/lib/gaze";
import { HeroScroll } from "./HeroScroll";
import { PingFigure } from "./PingFigure";
import s from "./hero.module.css";

const gaze = gazeJson as GazeData;

/**
 * "First sentence. The rest" → ["First sentence.", " The rest"]. R1: hero.intro[0] is the subtitle,
 * its first sentence semibold ("IT student at York University.") and the rest regular. Later intro
 * lines render as body-size supporting text (hero.module.css `.intro + .intro`).
 */
function splitLead(text: string): [string, string] {
  const m = /^(.+?[.!?])(\s.*)?$/s.exec(text);
  return m ? [m[1], m[2] ?? ""] : [text, ""];
}

/**
 * The hero (blueprint §3.1, PHASE4 "Hero DOM" + Revision R1). Server-rendered and complete without
 * JavaScript: the name, Ping with centred eyes, and the copy. Layer order and layout live in
 * hero.module.css. Client code: PingGaze (eyes, boop) and HeroScroll (pin + scrub), both lazy.
 *
 * JS hooks are data attributes (module class names are hashed); the global classes `name-patel`,
 * `ping`, `ping-squash`, `ping-boop` and `ping-shadow` are the QA and Phase 5 contract.
 */
export function Hero() {
  const intro = onlyVerified(hero.intro);
  return (
    <section id="home" aria-labelledby="hero-name" className={s.hero}>
      {/* z0 */}
      <div className={`${s.backdrop} grain`} aria-hidden="true" />
      <span className={s.halo} aria-hidden="true" />

      {/* z1 */}
      <h1 id="hero-name" className={`${s.name} font-display`}>
        <span className={s.vidhi} data-hero="vidhi">
          {person.firstName}
        </span>{" "}
        <span className={`name-patel ${s.patel}`}>{person.lastName}</span>
      </h1>

      {/* z2 shadow, z3 figure */}
      <PingFigure gaze={gaze} />

      {/* z4: same grid cell and metrics as the real "Patel"; only its lower 36% shows. */}
      <span className={`name-patel ${s.front} font-display`} aria-hidden="true" data-hero="front">
        {person.lastName}
      </span>

      {/* z5: one block; a right column on desktop, below Ping on phones. */}
      <div className={`${s.copy} font-sans`} data-hero="copy">
        {intro.map((line, i) => {
          if (i > 0) {
            return (
              <p key={line.text} className={s.intro}>
                {line.text}
              </p>
            );
          }
          const [lead, rest] = splitLead(line.text);
          return (
            <p key={line.text} className={s.intro}>
              <span className={s.lead}>{lead}</span>
              {rest}
            </p>
          );
        })}
        {hero.status.verified && <p className={s.status}>{hero.status.text}</p>}
        <p className={s.links}>
          {hero.ctas.map((c, i) => (
            <a key={c.href} href={c.href} className={i === 0 ? "btn btn-primary" : "btn"}>
              {c.label}
            </a>
          ))}
        </p>
        <p className={`${s.label} font-display`}>{mascot.wallLabel}</p>
      </div>

      <HeroScroll />
    </section>
  );
}
