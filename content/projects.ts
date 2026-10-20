// Vidhi's projects. Titles, descriptions, tags and repo links are ported
// verbatim from the old site (refs/old-site/components/sections/ProjectsSection.tsx).
// Only `verified: true` entries render; server components filter before
// passing data to client components (see `getProjects`).

export type ProjectImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type Project = {
  slug: string;
  title: string;
  /** Verbatim description from the old site. */
  description: string;
  tags: readonly string[];
  repo: string;
  /** H8 cover (4:5). Placeholder path until Higgsfield covers land. */
  cover: ProjectImage;
  /** Regraded original artwork (4:5), for the 4 projects whose image was valid. */
  original?: ProjectImage;
  verified: boolean;
  // TODO(vidhi): problem, role, what I learned, live demo link. Hidden until supplied.
  problem?: string;
  role?: string;
  learned?: string;
  demo?: string;
};

const cover = (slug: string, title: string): ProjectImage => ({
  src: `/work/covers/${slug}.webp`,
  width: 1200,
  height: 1500,
  alt: `${title}: felt-and-velvet diorama cover`,
});

const original = (slug: string, title: string): ProjectImage => ({
  src: `/work/originals/${slug}.jpg`,
  width: 1200,
  height: 1500,
  alt: `${title}: original project artwork, regraded`,
});

export const projects: readonly Project[] = [
  {
    slug: "handlescout",
    title: "HandleScout",
    description:
      "High-performance handle verification tool that checks real-time username availability across Instagram, TikTok, X, and YouTube. Responsive frontend with validation and optimized multi-platform API calls to streamline branding workflows.",
    tags: ["Python", "REST APIs", "HTML", "CSS", "JavaScript"],
    repo: "https://github.com/vidhip16/HandleScout",
    cover: cover("handlescout", "HandleScout"),
    verified: true,
  },
  {
    slug: "type-racer",
    title: "Type Racer",
    description:
      "Responsive typing game with live WPM tracking, DOM-based feedback, and animations. Selectable text lengths and real-time correctness highlighting.",
    tags: ["JavaScript", "HTML", "CSS"],
    repo: "https://github.com/vidhip16/Type-Racer",
    cover: cover("type-racer", "Type Racer"),
    original: original("type-racer", "Type Racer"),
    verified: true,
  },
  {
    slug: "washroom-finder",
    title: "Nearest Washroom Finder",
    description:
      "Location-based app to find public washrooms within 1.5 km using Overpass API and device geolocation. Interactive map and mobile-friendly UI.",
    tags: ["React.js", "JavaScript", "OpenStreetMap API", "Axios"],
    repo: "https://github.com/vidhip16/Nearest-Washroom-Locater",
    cover: cover("washroom-finder", "Nearest Washroom Finder"),
    original: original("washroom-finder", "Nearest Washroom Finder"),
    verified: true,
  },
  {
    slug: "image-generator",
    title: "Image Generator",
    description:
      "Full-stack AI image generator with prompt input, live preview, and downloads. Node/Express backend proxies OpenAI API with secure key management.",
    tags: ["HTML", "CSS", "JavaScript", "Node.js", "Express", "OpenAI API"],
    repo: "https://github.com/vidhip16/AI-Image-Generator",
    cover: cover("image-generator", "Image Generator"),
    original: original("image-generator", "Image Generator"),
    verified: true,
  },
  {
    slug: "video-extender",
    title: "Vertical Video Extender",
    description:
      "Transforms horizontal videos into vertical format by generating missing visual space. Flask/OpenCV backend with responsive UI and mobile preview.",
    tags: ["React", "Python", "Flask", "HTML", "CSS", "JavaScript", "Bootstrap"],
    repo: "https://github.com/vidhip16/Video-Enhancer",
    cover: cover("video-extender", "Vertical Video Extender"),
    verified: true,
  },
  {
    slug: "picture-converter",
    title: "Picture Converter",
    description:
      "Converts HEIC to JPG with batch folder support using Pillow/HEIF. Lightweight CLI utility for quick image prep and sharing.",
    tags: ["Python"],
    repo: "https://github.com/vidhip16/Picture-Converter",
    cover: cover("picture-converter", "Picture Converter"),
    original: original("picture-converter", "Picture Converter"),
    verified: true,
  },
];

/** Verified projects only. Call from server components. */
export function getProjects(): Project[] {
  return projects.filter((p) => p.verified);
}

export function getProject(slug: string): Project | undefined {
  return getProjects().find((p) => p.slug === slug);
}
