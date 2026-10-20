import { about, chapters, mascot, onlyVerified, room, type Skill } from "@/content/site";
import { getProjects } from "@/content/projects";
import { Chapter, type AboutData, type ChipData } from "./Chapter";
import { DotBubble } from "./DotBubble";
import { RoomScroll } from "./RoomScroll";
import s from "./room.module.css";

/**
 * Derived bubble for a skill with a project tile (content/site.ts `Skill.bubble`: "Derived when
 * omitted", e.g. "used in Type Racer"). Requested as a content string (sharedRequests).
 */

/**
 * The projection room (#about, blueprint §3.2 + PHASE5 "Workstream R" + Revision R1).
 *
 * Server-rendered: four chapters from content (About, Build, Data and systems, Support), each a
 * `[data-chapter]` at least 90svh tall, the text column from the gutter to 52vw on desktop. Only
 * verified content gets this far, and only resolved plain data reaches the client islands.
 * #about has no background fill: the night is body's --bg, so the fixed dot canvas behind main shows
 * through. Client islands: SkillChip (per chip), DotBubble (the room anchor + the bubble) and
 * RoomScroll (roomInView, then the lazy scroll controller or the reduced-motion hard cuts).
 */
export function ProjectionRoom() {
  const titles = new Map(getProjects().map((p) => [p.slug, p.title] as const));

  const chip = (skill: Skill): ChipData => {
    const title = skill.project ? titles.get(skill.project) : undefined;
    const slug = title ? skill.project : undefined;
    return {
      name: skill.name,
      slug,
      href: slug ? undefined : skill.href,
      bubble: skill.bubble ?? (title ? `${room.usedIn} ${title}` : undefined),
    };
  };

  const aboutData: AboutData = {
    heading: about.heading,
    bio: onlyVerified(about.bio),
    photo: about.photo,
  };

  return (
    <section id="about" aria-labelledby="about-title" className={s.room}>
      <div className={`${s.atmos} grain`} aria-hidden="true">
        <div className={s.beam} />
      </div>

      {chapters.map((ch, i) => (
        <Chapter
          key={ch.id}
          chapter={ch}
          numeral={i + 1}
          chips={onlyVerified(ch.skills).map(chip)}
          about={ch.id === "about" ? aboutData : undefined}
        />
      ))}

      <DotBubble />
      <RoomScroll boopLine={mascot.boopLine} />
    </section>
  );
}
