import { describe, expect, it } from "vitest";
import {
  AEO_FAQS,
  ENTITY_RELATIONSHIPS,
  VPSYCH_ENTITY,
  aeoMedicalOrganizationSchema,
  aeoOrganizationSchema,
  aeoSoftwareSchema,
  buildKnowledgeGraphDocument,
  buildLlmsTxt,
  faqsByCategory,
} from "@/lib/aeo/knowledge";
import { PUBLIC_INDEXABLE_PATHS, isSeoAssetPath } from "@/lib/seo/site";

describe("Mission 27 — AI Engine Optimization (AEO)", () => {
  it("defines a complete product entity card", () => {
    expect(VPSYCH_ENTITY.name).toBe("VPsych");
    expect(VPSYCH_ENTITY.purpose.length).toBeGreaterThan(40);
    expect(VPSYCH_ENTITY.targetUsers.length).toBeGreaterThanOrEqual(4);
    expect(VPSYCH_ENTITY.features.length).toBeGreaterThanOrEqual(5);
    expect(VPSYCH_ENTITY.notClaims.length).toBeGreaterThanOrEqual(3);
    expect(VPSYCH_ENTITY.clinicalEvidenceStance.toLowerCase()).toContain(
      "simulation",
    );
  });

  it("covers medical, educational, and clinical FAQs", () => {
    expect(faqsByCategory("medical").length).toBeGreaterThanOrEqual(2);
    expect(faqsByCategory("educational").length).toBeGreaterThanOrEqual(2);
    expect(faqsByCategory("clinical").length).toBeGreaterThanOrEqual(2);
    expect(AEO_FAQS.some((f) => /HIPAA/i.test(f.question))).toBe(true);
    expect(AEO_FAQS.some((f) => /What is VPsych/i.test(f.question))).toBe(
      true,
    );
  });

  it("exposes entity relationships for knowledge graphs", () => {
    expect(ENTITY_RELATIONSHIPS.length).toBeGreaterThanOrEqual(8);
    expect(
      ENTITY_RELATIONSHIPS.some(
        (r) => r.subject === "VPsych" && r.object === "EducationalApplication",
      ),
    ).toBe(true);
  });

  it("builds prompt-friendly llms.txt with answerable URLs", () => {
    const txt = buildLlmsTxt();
    expect(txt).toContain("# VPsych");
    expect(txt).toContain("/about");
    expect(txt).toContain("/faq");
    expect(txt).toContain("knowledge-graph.json");
    expect(txt).toContain("Not a hospital");
    expect(txt.toLowerCase()).toContain("arabic");
  });

  it("builds machine-readable knowledge graph JSON", () => {
    const kg = buildKnowledgeGraphDocument();
    expect(kg["@type"]).toBe("Dataset");
    expect(kg.about["@type"]).toBe("SoftwareApplication");
    expect(kg.hasPart.length).toBe(AEO_FAQS.length);
    expect(kg.entityRelationships.length).toBe(ENTITY_RELATIONSHIPS.length);
  });

  it("emits Organization, Software, and MedicalOrganization schemas", () => {
    expect(aeoOrganizationSchema()["@type"]).toBe("Organization");
    expect(aeoSoftwareSchema()["@type"]).toBe("SoftwareApplication");
    expect(aeoMedicalOrganizationSchema()["@type"]).toBe("MedicalOrganization");
    expect(aeoSoftwareSchema().featureList.length).toBeGreaterThan(0);
  });

  it("indexes AEO routes as public SEO assets", () => {
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/about");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/faq");
    expect(isSeoAssetPath("/llms.txt")).toBe(true);
    expect(isSeoAssetPath("/knowledge-graph.json")).toBe(true);
    expect(isSeoAssetPath("/.well-known/llms.txt")).toBe(true);
  });
});
