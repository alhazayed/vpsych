import { getSiteOrigin } from "@/lib/seo/site";
import { sitemapIndexXml } from "@/lib/seo/sitemap-xml";

export const dynamic = "force-static";

/** XML sitemap index: marketing + auth + AI knowledge assets. */
export async function GET() {
  const origin = getSiteOrigin();
  const xml = sitemapIndexXml([
    `${origin}/sitemaps/marketing.xml`,
    `${origin}/sitemaps/auth.xml`,
    `${origin}/sitemaps/aeo.xml`,
  ]);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
