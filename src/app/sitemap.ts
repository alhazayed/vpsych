import type { MetadataRoute } from "next";

const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://vpsych.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/login",
    "/signup",
    "/privacy",
    "/terms",
    "/validation",
  ] as const;
  const lastModified = new Date();
  return paths.map((path) => ({
    url: path === "/" ? ORIGIN : `${ORIGIN}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
