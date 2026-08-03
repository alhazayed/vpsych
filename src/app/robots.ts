import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", "/site-map", "/rss.xml"],
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
