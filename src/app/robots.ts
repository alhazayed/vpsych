import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/login",
          "/signup",
          "/site-map",
          "/about",
          "/faq",
          "/contact",
          "/research",
          "/clinical",
          "/help",
          "/pricing",
          "/terms",
          "/privacy",
          "/release-notes",
          "/rss.xml",
          "/launch-readiness.json",
          "/llms.txt",
          "/knowledge-graph.json",
          "/citations.json",
          "/.well-known/llms.txt",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/avatars",
          "/sessions",
          "/learning",
          "/faculty",
          "/auth/",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin.replace(/^https?:\/\//, ""),
  };
}
