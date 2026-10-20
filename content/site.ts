// All site copy. Every claim carries `verified`; only verified claims render.
// Unverified items (phone, unconfirmed skills/stats, job duties) are NOT in
// this file at all. They live in the private content checklist and are added
// here with `verified: true` once Vidhi confirms them.
// Server components filter with `onlyVerified` before passing data to clients.

export type Verified = { verified: boolean };

export function onlyVerified<T extends Verified>(items: readonly T[]): T[] {
  return items.filter((i) => i.verified);
}

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://2025-website-portfolio.vercel.app"
).replace(/\/$/, "");

/**
 * The mascot. Every name, alt text, speech line and label that mentions the
 * mascot comes from here, so a CP1 pick other than Ping (a) is a one-file change.
 */
export const mascot = {
  name: "Ping",
  /** Lower-case noun used in prose ("plush bunny"). */
  noun: "bunny",
  alt: "Ping, Vidhi's lilac plush bunny mascot",
  boopLabel: "Boop Ping",
  /** Speech bubble after a boop (Departure Mono). */
  boopLine: "pong!",
  /** Document title while the tab is hidden. */
  sleepTitle: "Ping is waiting…",
  wallLabel: "Ping, 2026. Flocked velvet, one blank keycap. Looks where you look.",
  /** Gyroscope opt-in button (touch). */
  lookAroundLabel: "Let Ping look around",
  /** Announced when the visitor declines motion-sensor access. */
  lookAroundDenied: "Motion access is off, so Ping will keep following your taps instead.",
  sleepingAlt: "Ping asleep, hugging a keycap",
  lostAlt: "Ping holding an empty picture frame",
  peekAlt: "Ping peeking over the edge",
  /** Console greeting (ASCII art lives in ConsoleHello). */
  consoleLine: "hi recruiter, the source is on github.com/vidhip16",
  /** Headshot caption tail: "…with the plush that inspired Ping." */
  inspiredBy: "the plush that inspired Ping",
  /** Footer back-to-top label. */
  backToTop: "Back to top",
} as const;

export const person = {
  name: "Vidhi Patel",
  firstName: "Vidhi",
  lastName: "Patel",
  jobTitle: "Junior IT Associate",
  location: "Toronto, ON",
  // TODO(vidhi): confirm the canonical email (checklist #1). The old site
  // displayed this address; its mailto pointed at a different one.
  email: "vidhipat2005@gmail.com",
  github: "https://github.com/vidhip16",
  linkedin: "https://www.linkedin.com/in/vidhi-patel-717256309/",
  school: "York University",
} as const;

export const seo = {
  title: "Vidhi Patel | IT Student & Junior IT Associate, Toronto",
  description:
    "Vidhi Patel is an IT student at York University and a Junior IT Associate in Toronto who builds small, focused tools. See projects, skills and how to get in touch.",
  ogLine: "IT student and Junior IT Associate, Toronto",
  /** OG card subtitle (R1): a semibold lead sentence, then a regular one. */
  ogLead: "IT student at York University.",
  ogFollow: "Junior IT Associate in Toronto.",
} as const;

export type Line = Verified & { text: string };

export const hero = {
  intro: [
    {
      // R1 subtitle: a semibold lead sentence, then a regular one (split on the first full stop).
      text: "IT student at York University. Junior IT Associate in Toronto.",
      verified: true,
    },
    { text: "I build small tools that do one job well.", verified: true },
    // TODO(vidhi): a line about the job duties, once supplied (checklist #3).
  ] satisfies Line[],
  status: {
    text: "Currently: Junior IT Associate at Metro Compactor Service Inc., Toronto.",
    verified: true,
  } satisfies Line,
  ctas: [
    { label: "See the work", href: "#work" },
    { label: "Get in touch", href: "#contact" },
  ],
} as const;

export const about = {
  heading: "About",
  bio: [
    {
      text: "I'm studying Information Technology at York University and working as a Junior IT Associate. I like the unglamorous parts of tech: tools that save someone ten minutes and systems that just work. Outside work I make music and film, play competitive games, and automate things that probably didn't need automating.",
      verified: true,
    },
    // TODO(vidhi): onboarding-documentation clause (checklist #13).
  ] satisfies Line[],
  photo: {
    src: "/about/vidhi-octo-zone.jpg",
    width: 1200,
    height: 1600,
    alt: "Vidhi at The Octo Zone arcade, holding a white plush bunny under neon pink and blue light",
    // TODO(vidhi): add the location only if Vidhi wants it (checklist #12).
    caption: `Vidhi at The Octo Zone, with ${mascot.inspiredBy}.`,
  },
} as const;

/**
 * A skill chip. `project` is a project slug (scrolls to its tile and names it
 * in the dot bubble); `href` is an external proof link when no tile exists.
 */
export type Skill = Verified & {
  name: string;
  project?: string;
  href?: string;
  /** Bubble text, e.g. "used in Type Racer". Derived when omitted. */
  bubble?: string;
};

export type Chapter = {
  id: "about" | "build" | "data" | "support";
  title: string;
  /** Dot shape index shown beside this chapter (see lib/dots targets). */
  shape: 1 | 2 | 3 | 4;
  lede?: Line;
  skills: Skill[];
};

export const chapters: Chapter[] = [
  { id: "about", title: "About", shape: 1, skills: [] },
  {
    id: "build",
    title: "Build",
    shape: 2,
    lede: { text: "The languages and frameworks behind the projects below.", verified: true },
    skills: [
      { name: "Python", project: "handlescout", verified: true },
      { name: "JavaScript", project: "type-racer", verified: true },
      { name: "TypeScript", verified: true },
      { name: "React", project: "washroom-finder", verified: true },
      { name: "Node/Express", project: "image-generator", verified: true },
      { name: "Flask", project: "video-extender", verified: true },
      { name: "HTML/CSS", project: "type-racer", verified: true },
    ],
  },
  {
    id: "data",
    title: "Data and systems",
    shape: 3,
    lede: { text: "Where the data lives and how the pieces talk to each other.", verified: true },
    skills: [
      {
        name: "SQL/PostgreSQL",
        href: "https://github.com/vidhip16/CRM-Database-System",
        bubble: "used in CRM-Database-System",
        verified: true,
      },
      { name: "REST APIs", project: "handlescout", verified: true },
      { name: "Git/GitHub", href: "https://github.com/vidhip16", bubble: "all of it, on GitHub", verified: true },
      { name: "OpenCV/Pillow", project: "picture-converter", verified: true },
      { name: "Networking coursework", bubble: "York University coursework", verified: true },
    ],
  },
  {
    id: "support",
    title: "Support",
    shape: 4,
    lede: {
      text: "Built small internal tools to take repetitive tasks off people's plates.",
      verified: true,
    },
    skills: [
      { name: "Troubleshooting", verified: true },
      { name: "Documentation", verified: true },
      { name: "Onboarding", verified: true },
      { name: "Scripting and automation", project: "picture-converter", verified: true },
    ],
  },
];

export type Role = Verified & {
  id: string;
  lane: "study" | "work";
  title: string;
  org: string;
  start: number;
  /** null = present */
  end: number | null;
  current?: boolean;
  description?: string;
};

export const experience = {
  heading: "Experience",
  /** Year-range words, kept as words so screen readers read "2023 to present". */
  dates: { to: "to", present: "present" },
  lanes: { study: "Study", work: "Work" },
  roles: [
    {
      id: "york",
      lane: "study",
      title: "B.A. Information Technology",
      org: "York University",
      start: 2023,
      end: null, // TODO(vidhi): expected graduation date (checklist #8)
      description:
        "Coursework in programming, systems analysis, networks, and user-focused design. Focused on building software, databases, and websites that solve real-world problems.",
      verified: true,
    },
    {
      id: "vortex",
      lane: "work",
      title: "Intern",
      org: "Vortex Freight Systems",
      start: 2023,
      end: 2026, // TODO(vidhi): co-op or part-time? (checklist #4)
      // TODO(vidhi): two lines on the role (checklist #3)
      verified: true,
    },
    {
      id: "metro",
      lane: "work",
      title: "Junior IT Associate",
      org: "Metro Compactor Service Inc.",
      start: 2026,
      end: null,
      current: true,
      // TODO(vidhi): two lines on the role (checklist #3)
      verified: true,
    },
  ] satisfies Role[],
} as const;

export const work = {
  heading: "Small tools that do one job well.",
  intro: "Six projects, each built to solve one specific problem.",
  listToggle: "View as list",
  mosaicToggle: "View as mosaic",
  /** Interface labels for the mosaic and the /work/[slug] pages (§6.3, §6.4). */
  ui: {
    /** Cursor bubble over a mosaic tile (fine pointers only). */
    viewBubble: "View",
    /** Detail page: heading above the project's tags. */
    builtWith: "Built with",
    /** Detail page: the repository button. */
    viewCode: "View code on GitHub",
    /** Detail page: returns to the mosaic at the stored scroll position. */
    back: "Back to the gallery",
    /** Detail page: heading above the regraded original artwork. */
    original: "Original artwork",
    /** Detail page: prev/next labels and their landmark name. */
    prev: "Previous project",
    next: "Next project",
    moreProjects: "More projects",
    /** Alt text of the /work/[slug] Open Graph card. */
    ogAlt: `A project from ${person.name}'s portfolio`,
  },
} as const;

export const contact = {
  links: { linkedin: "LinkedIn", github: "GitHub" },
  heading: "Say hello.",
  lede: "Questions, roles, or a project you'd like a hand with.",
  form: {
    name: "Name",
    email: "Email",
    message: "Message",
    submit: "Send message",
    pending: "Sending…",
    success: "Message sent. Pong! Vidhi will reply by email.",
    /** Live counter text; {count} and {max} are replaced. */
    counter: "{count} of {max} characters",
    errors: {
      name: "Add your name.",
      email: "Enter an email like name@example.com.",
      message: "Write at least 10 characters.",
      server: `Couldn't send right now. Try again, or email ${person.email} directly.`,
      tooLarge: `That message is too long to send here. Shorten it, or email ${person.email} directly.`,
      nameLong: "Keep your name to 80 characters or fewer.",
      messageLong: "Keep your message to 4,000 characters or fewer.",
    },
  },
} as const;

export const footer = {
  line: "The gallery never really closes.",
  vitalsPrefix: "This visit: page ready in",
  vitalsInpPrefix: "clicks answered within",
} as const;

export const notFound = {
  title: "Page not found",
  heading: "This page isn't on the wall.",
  back: "Back to the gallery",
} as const;

export const nav = [
  { label: "Work", href: "#work", id: "work" },
  { label: "About", href: "#about", id: "about" },
  { label: "Experience", href: "#experience", id: "experience" },
  { label: "Contact", href: "#contact", id: "contact" },
] as const;
