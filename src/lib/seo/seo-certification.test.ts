import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  getSiteOrigin,
  hreflangUrl,
  isPrivatePath,
  isSeoAssetPath,
  PUBLIC_INDEXABLE_PATHS,
} from "@/lib/seo/site";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  medicalOrganizationSchema,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo/schema";

describe("Mission 26 — Technical SEO", () => {
  it("defines public indexable paths and private prefixes", () => {
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/site-map");
    expect(isPrivatePath("/avatars")).toBe(true);
    expect(isPrivatePath("/sessions/abc")).toBe(true);
    expect(isPrivatePath("/api/sessions")).toBe(true);
    expect(isPrivatePath("/")).toBe(false);
    expect(isPrivatePath("/site-map")).toBe(false);
    expect(isSeoAssetPath("/robots.txt")).toBe(true);
    expect(isSeoAssetPath("/sitemap.xml")).toBe(true);
    expect(isSeoAssetPath("/rss.xml")).toBe(true);
    expect(isSeoAssetPath("/sitemaps/marketing.xml")).toBe(true);
  });

  it("builds absolute and hreflang URLs", () => {
    expect(getSiteOrigin()).toMatch(/^https?:\/\//);
    expect(absoluteUrl("/login")).toMatch(/\/login$/);
    expect(hreflangUrl("/", "ar")).toContain("hl=ar");
    expect(hreflangUrl("/login", "en")).toContain("hl=en");
  });

  it("emits required Schema.org graphs", () => {
    expect(organizationSchema()["@type"]).toBe("Organization");
    expect(softwareApplicationSchema()["@type"]).toBe("SoftwareApplication");
    expect(medicalOrganizationSchema()["@type"]).toBe("MedicalOrganization");
    expect(websiteSchema()["@type"]).toBe("WebSite");
    const faq = faqPageSchema([
      { question: "Q?", answer: "A." },
    ]);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(1);
    expect(articleSchema({ title: "T", description: "D" })["@type"]).toBe(
      "Article",
    );
    expect(
      breadcrumbSchema([{ name: "Home", path: "/" }]).itemListElement,
    ).toHaveLength(1);
  });
});
