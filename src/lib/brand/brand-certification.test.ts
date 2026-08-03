import { describe, expect, it } from "vitest";
import {
  BRAND_PERSONA_JOURNEYS,
  BRAND_PUBLIC_TRUST_PATHS,
  BRAND_VALUE_PROPOSITION,
} from "@/lib/brand/journeys";
import { getPrivacySections, getTermsSections } from "@/lib/brand/legal-content";
import { PUBLIC_INDEXABLE_PATHS } from "@/lib/seo/site";

describe("Mission 29 — Brand & Conversion Certification", () => {
  it("defines bilingual value proposition", () => {
    expect(BRAND_VALUE_PROPOSITION.en.toLowerCase()).toContain("ai patient");
    expect(BRAND_VALUE_PROPOSITION.ar.length).toBeGreaterThan(20);
  });

  it("covers all required persona journeys", () => {
    const personas = Object.keys(BRAND_PERSONA_JOURNEYS);
    expect(personas).toEqual(
      expect.arrayContaining([
        "first_time_visitor",
        "medical_student",
        "psychologist",
        "psychiatrist",
        "university",
        "hospital",
      ]),
    );
    for (const journey of Object.values(BRAND_PERSONA_JOURNEYS)) {
      expect(journey.steps.length).toBeGreaterThanOrEqual(3);
      expect(journey.primaryCta.startsWith("/")).toBe(true);
    }
  });

  it("routes institutional personas to contact, not blind signup", () => {
    expect(BRAND_PERSONA_JOURNEYS.university.primaryCta).toBe("/contact");
    expect(BRAND_PERSONA_JOURNEYS.hospital.primaryCta).toBe("/contact");
  });

  it("publishes legal, help, and pricing trust paths", () => {
    for (const path of BRAND_PUBLIC_TRUST_PATHS) {
      expect(PUBLIC_INDEXABLE_PATHS).toContain(path);
    }
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/terms");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/privacy");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/help");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/pricing");
  });

  it("provides bilingual terms and privacy sections", () => {
    expect(getTermsSections("en").length).toBeGreaterThanOrEqual(5);
    expect(getTermsSections("ar").length).toBe(getTermsSections("en").length);
    expect(getPrivacySections("en").some((s) => s.id === "cookies")).toBe(true);
    expect(getPrivacySections("ar").some((s) => /ملفات/.test(s.heading))).toBe(
      true,
    );
  });
});
