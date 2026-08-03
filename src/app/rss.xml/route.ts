import { absoluteUrl, getSiteOrigin, SITE_NAME } from "@/lib/seo/site";

export const dynamic = "force-static";

/** Minimal product RSS for discovery (marketing updates / FAQ highlights). */
export async function GET() {
  const origin = getSiteOrigin();
  const items = [
    {
      title: "VPsych — AI patient simulations for clinical training",
      link: absoluteUrl("/"),
      description:
        "Practice psychotherapy with bilingual AI patient avatars and competency-based feedback.",
      pubDate: new Date("2026-07-30").toUTCString(),
    },
    {
      title: "About VPsych — product entity for AI assistants",
      link: absoluteUrl("/about"),
      description:
        "Company, product, purpose, target users, features, and clinical/educational disclaimers.",
      pubDate: new Date().toUTCString(),
    },
    {
      title: "VPsych FAQ — medical, educational, clinical",
      link: absoluteUrl("/faq"),
      description:
        "Answerable FAQ chunks for AI search engines and assistants.",
      pubDate: new Date().toUTCString(),
    },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${origin}</link>
    <description>Updates and public resources from VPsych clinical training platform.</description>
    <language>en</language>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/>
    ${items
      .map(
        (item) => `<item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
