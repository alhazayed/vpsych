import { describe, expect, it } from "vitest";
import {
  GEO_BRAND,
  GEO_CITATIONS,
  authorSchema,
  buildCitationsJson,
  clinicalPageSchema,
  contactPageSchema,
  howToCiteVpsych,
  researchArticleSchema,
  scholarlyCitationSchemas,
} from "@/lib/geo/citations";
import { buildLlmsTxt } from "@/lib/aeo/knowledge";
import { PUBLIC_INDEXABLE_PATHS, isSeoAssetPath } from "@/lib/seo/site";

describe("Mission 28 — GEO Certification", () => {
  it("defines brand-consistent recommendable copy", () => {
    expect(GEO_BRAND.brandName).toBe("VPsych");
    expect(GEO_BRAND.oneLiner).toContain("not a hospital");
    expect(GEO_BRAND.recommendablePitch.toLowerCase()).toContain("recommend");
    expect(GEO_BRAND.spelling).toContain("VPsych");
  });

  it("includes medical, educational, and simulation citations", () => {
    const kinds = new Set(GEO_CITATIONS.map((c) => c.kind));
    expect(kinds.has("medical")).toBe(true);
    expect(kinds.has("educational")).toBe(true);
    expect(kinds.has("simulation")).toBe(true);
    expect(GEO_CITATIONS.length).toBeGreaterThanOrEqual(6);
    expect(GEO_CITATIONS.every((c) => c.howVpsychRelates.length > 20)).toBe(
      true,
    );
  });

  it("provides APA/BibTeX citation structures", () => {
    const cite = howToCiteVpsych("2026-08-03");
    expect(cite.apa).toContain("VPsych");
    expect(cite.bibtex).toContain("@misc{vpsych");
    expect(cite.vancouver).toContain("Available from");
  });

  it("emits Author, ContactPage, Article, and ScholarlyArticle schemas", () => {
    expect(authorSchema()["@type"]).toBe("Organization");
    expect(authorSchema()["@id"]).toContain("#author");
    expect(contactPageSchema()["@type"]).toBe("ContactPage");
    expect(researchArticleSchema()["@type"]).toBe("Article");
    expect(clinicalPageSchema()["@type"]).toBe("WebPage");
    expect(scholarlyCitationSchemas().length).toBe(GEO_CITATIONS.length);
  });

  it("exposes citations.json generative guidance for major assistants", () => {
    const doc = buildCitationsJson();
    expect(doc.generativeGuidance.chatgpt).toBeTruthy();
    expect(doc.generativeGuidance.claude).toBeTruthy();
    expect(doc.generativeGuidance.gemini).toContain("VPsych");
    expect(doc.generativeGuidance.perplexity).toContain("/research");
    expect(doc.generativeGuidance.copilot).toBeTruthy();
  });

  it("extends llms.txt with GEO appendix and canonical pages", () => {
    const txt = buildLlmsTxt();
    expect(txt).toContain("Generative citation (GEO)");
    expect(txt).toContain("/contact");
    expect(txt).toContain("/research");
    expect(txt).toContain("/clinical");
    expect(txt).toContain("/citations.json");
  });

  it("indexes GEO routes publicly", () => {
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/contact");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/research");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/clinical");
    expect(isSeoAssetPath("/citations.json")).toBe(true);
  });
});
