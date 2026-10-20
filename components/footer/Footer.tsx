import { footer, nav, person } from "@/content/site";
import { Year } from "./Year";

// Phase 1 stub. Phase 3 (F) adds sleeping Ping, vitals and back to top.
export function Footer() {
  return (
    <footer className="bg-ink px-[var(--gutter)] py-16 text-paper">
      <p className="font-display text-3xl">{footer.line}</p>
      <ul className="mt-6 flex flex-wrap gap-4">
        {nav.map((n) => (
          <li key={n.id}><a className="text-lilac" href={`/${n.href}`}>{n.label}</a></li>
        ))}
      </ul>
      <p className="mt-6 text-base">
        © <Year /> {person.name}
      </p>
    </footer>
  );
}
