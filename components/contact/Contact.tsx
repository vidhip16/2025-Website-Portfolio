import { contact, person } from "@/content/site";

// Phase 1 stub. Phase 3 (F) adds the hardened form.
export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="px-[var(--gutter)] py-24">
      <h2 id="contact-title" className="text-5xl">{contact.heading}</h2>
      <p className="mt-4 max-w-[68ch]">{contact.lede}</p>
      <ul className="mt-6 space-y-2">
        <li><a href={`mailto:${person.email}`}>{person.email}</a></li>
        <li><a href={person.linkedin} rel="noopener noreferrer">LinkedIn</a></li>
        <li><a href={person.github} rel="noopener noreferrer">GitHub</a></li>
        <li>{person.location}</li>
      </ul>
    </section>
  );
}
