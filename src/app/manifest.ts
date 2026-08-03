import type { MetadataRoute } from "next";
import { getSiteOrigin, SITE_NAME } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "AI patient simulations for psychiatric and psychotherapy clinical training.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#0f4c81",
    lang: "en",
    dir: "auto",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    categories: ["education", "medical", "productivity"],
    id: getSiteOrigin(),
  };
}
