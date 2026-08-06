import type { MetadataRoute } from "next";

const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://vpsych.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", "/privacy", "/terms", "/validation"],
        disallow: [
          "/api/",
          "/admin/",
          "/avatars",
          "/sessions",
          "/learning",
          "/auth/",
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN.replace(/^https?:\/\//, ""),
  };
}
