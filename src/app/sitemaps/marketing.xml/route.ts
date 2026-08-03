import { urlsetXml } from "@/lib/seo/sitemap-xml";

export const dynamic = "force-static";

export async function GET() {
  const xml = urlsetXml([
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/about", priority: "0.9", changefreq: "monthly" },
    { path: "/faq", priority: "0.9", changefreq: "monthly" },
    { path: "/site-map", priority: "0.4", changefreq: "monthly" },
  ]);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
