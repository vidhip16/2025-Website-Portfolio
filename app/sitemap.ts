import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";
import { getProjects } from "@/content/projects";

/**
 * The home page and every verified /work/<slug> page.
 *
 * No `lastModified`: under Cache Components a `new Date()` here would be a
 * build timestamp rather than a real edit date, and it would need "use cache".
 * A wrong lastmod is worse than none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...getProjects().map((p) => ({
      url: `${SITE_URL}/work/${p.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
