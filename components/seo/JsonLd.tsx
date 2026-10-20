import { SITE_URL, about, chapters, experience, onlyVerified, person, seo, type Role } from "@/content/site";

/**
 * Serialise structured data for a <script type="application/ld+json">.
 * JSON.stringify does not escape "<", so a "</script>" inside any string could
 * close the tag early; "<" is the same character to a JSON parser.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const PROFILE_ID = `${SITE_URL}/#profile`;
const HOME = `${SITE_URL}/`;

/** Built only from verified facts in content/site.ts. */
function buildGraph() {
  const roles: readonly Role[] = onlyVerified(experience.roles);
  const currentJob = roles.find((r) => r.lane === "work" && r.current);
  // "Toronto, ON" → locality + region. Ontario is in Canada.
  const [locality, region] = person.location.split(",").map((s) => s.trim());
  const skills = chapters.flatMap((c) => onlyVerified(c.skills).map((s) => s.name));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: person.name,
        givenName: person.firstName,
        familyName: person.lastName,
        url: HOME,
        image: `${SITE_URL}${about.photo.src}`,
        jobTitle: person.jobTitle,
        ...(currentJob && {
          worksFor: { "@type": "Organization", name: currentJob.org },
        }),
        alumniOf: { "@type": "CollegeOrUniversity", name: person.school },
        address: {
          "@type": "PostalAddress",
          addressLocality: locality,
          addressRegion: region,
          addressCountry: "CA",
        },
        ...(skills.length > 0 && { knowsAbout: skills }),
        sameAs: [person.github, person.linkedin],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: HOME,
        name: person.name,
        inLanguage: "en-CA",
        author: { "@id": PERSON_ID },
      },
      {
        "@type": "ProfilePage",
        "@id": PROFILE_ID,
        url: HOME,
        name: seo.title,
        description: seo.description,
        inLanguage: "en-CA",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": PERSON_ID },
      },
    ],
  };
}

/**
 * Site-wide JSON-LD: Person, WebSite and ProfilePage in one @graph
 * (blueprint §8). Server component; mount once in the root layout. Every node
 * carries an absolute `url` and `@id`, so the block is accurate on any route.
 */
export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildGraph()) }}
    />
  );
}
