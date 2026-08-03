import { absoluteUrl, getSiteOrigin } from "@/lib/seo/site";

export function urlsetXml(
  entries: {
    path: string;
    priority: string;
    changefreq: string;
  }[],
) {
  const now = new Date().toISOString();
  const urls = entries
    .map((e) => {
      const canonical = absoluteUrl(e.path);
      // Prefer trailing slash on origin for clean ?hl= query forms.
      const hreflangBase =
        e.path === "/" ? `${getSiteOrigin()}/` : canonical;
      const sep = hreflangBase.includes("?") ? "&" : "?";
      return `<url>
  <loc>${canonical}</loc>
  <lastmod>${now}</lastmod>
  <changefreq>${e.changefreq}</changefreq>
  <priority>${e.priority}</priority>
  <xhtml:link rel="alternate" hreflang="en" href="${hreflangBase}${sep}hl=en"/>
  <xhtml:link rel="alternate" hreflang="ar" href="${hreflangBase}${sep}hl=ar"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}"/>
</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

export function sitemapIndexXml(locs: string[]) {
  const body = locs
    .map(
      (loc) => `  <sitemap>
    <loc>${loc}</loc>
  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}
