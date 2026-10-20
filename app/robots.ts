import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

/**
 * AI crawlers are named explicitly so the opt-in is unambiguous (blueprint §8:
 * "robots.ts allowing AI crawlers"), even though `*` already allows them.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_CRAWLERS, allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
