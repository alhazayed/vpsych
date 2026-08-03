import { absoluteUrl, getSiteOrigin } from "@/lib/seo/site";

export const dynamic = "force-static";

/** AI / machine-readable discovery assets (not HTML pages). */
export async function GET() {
  const origin = getSiteOrigin();
  const now = new Date().toISOString();
  const assets = [
    `${origin}/llms.txt`,
    `${origin}/.well-known/llms.txt`,
    `${origin}/knowledge-graph.json`,
    absoluteUrl("/rss.xml"),
  ];
  const urls = assets
    .map(
      (loc) => `<url>
  <loc>${loc}</loc>
  <lastmod>${now}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
