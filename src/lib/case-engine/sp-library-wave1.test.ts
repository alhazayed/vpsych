import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authoredTherapyCuesFor } from "@/lib/case-engine/authored-therapy-cues";
import { WAVE1_THERAPY_CUES } from "@/lib/case-engine/authored-therapy-cues-wave1";
import { BUILTIN_DISORDERS, DISORDER_IDS } from "@/lib/case-engine/catalog";
import { getBuiltinPersonality } from "@/lib/personality-engine/catalog";
import { findTemplateBySlug } from "@/lib/scenario-templates/catalog";

const WAVE1_SLUGS = Object.keys(WAVE1_THERAPY_CUES);

const DEFAULT_DISORDER: Record<string, string> = {
  "elena-vasquez": "ptsd",
  "marcus-okonkwo": "ocd",
  "devon-wright": "schizophrenia",
  "riley-park": "bpd",
  "caleb-brooks": "alcohol-use-disorder",
  "harper-ellis": "eating-disorders",
  "leo-nguyen": "adult-adhd",
  "nathan-cole": "bipolar-mania",
  "sofia-morales": "mdd-recurrent-moderate",
  "tyler-bennett": "social-anxiety",
};

describe("Wave-1 Simulated Patient Library", () => {
  it("registers 10 new bilingual case files in personas/", () => {
    const root = join(process.cwd(), "personas");
    const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8")) as {
      cases: Array<{ slug: string; personalities: Array<{ locale: string }> }>;
    };
    for (const slug of WAVE1_SLUGS) {
      const file = join(root, `${slug}.case.json`);
      const caseJson = JSON.parse(readFileSync(file, "utf8")) as {
        slug: string;
        schema_version: number;
        clinical_core: {
          disorder: string;
          symptom_profile: unknown[];
          disclosure_rules: unknown[];
          session_goals: unknown[];
          case_file?: {
            therapy_behaviour?: { educational_objectives?: unknown[] };
          };
        };
        personalities: Record<string, { authored_natively?: boolean; never_translate?: boolean }>;
        rubric: unknown[];
      };
      expect(caseJson.slug).toBe(slug);
      expect(caseJson.schema_version).toBe(2);
      expect(caseJson.personalities["en-US"]?.authored_natively).toBe(true);
      expect(caseJson.personalities["ar-JO"]?.never_translate).toBe(true);
      expect(caseJson.clinical_core.symptom_profile.length).toBeGreaterThan(4);
      expect(caseJson.clinical_core.disclosure_rules.length).toBeGreaterThan(3);
      expect(caseJson.clinical_core.session_goals.length).toBeGreaterThan(2);
      expect(
        caseJson.clinical_core.case_file?.therapy_behaviour?.educational_objectives
          ?.length ?? 0,
      ).toBeGreaterThan(2);
      expect(caseJson.rubric.length).toBeGreaterThan(3);
      expect(index.cases.some((c) => c.slug === slug)).toBe(true);
    }
    expect(index.cases.length).toBeGreaterThanOrEqual(12);
  });

  it("ships SVG portraits for every Wave-1 patient", () => {
    const dir = join(process.cwd(), "public/avatars");
    const files = readdirSync(dir);
    for (const slug of WAVE1_SLUGS) {
      expect(files).toContain(`${slug}.svg`);
    }
  });

  it("wires therapy cues, personality catalog, and disorder packages", () => {
    for (const slug of WAVE1_SLUGS) {
      expect(authoredTherapyCuesFor(slug)?.process_lines.length).toBeGreaterThan(4);
      expect(getBuiltinPersonality(slug, "en-US")).not.toBeNull();
      expect(getBuiltinPersonality(slug, "ar-JO")).not.toBeNull();
      const disorderSlug = DEFAULT_DISORDER[slug];
      expect(disorderSlug).toBeTruthy();
      expect(
        BUILTIN_DISORDERS.some((d) => d.slug === disorderSlug && d.is_active),
      ).toBe(true);
    }
    expect(DISORDER_IDS.ocd).toBeTruthy();
    expect(DISORDER_IDS.eating).toBeTruthy();
    expect(DISORDER_IDS.socialAnxiety).toBeTruthy();
  });

  it("exposes educational scenario templates for key Wave-1 pathways", () => {
    expect(findTemplateBySlug("ptsd-risk-assessment-en")?.default_persona_slug).toBe(
      "elena-vasquez",
    );
    expect(findTemplateBySlug("ocd-erp-assessment-en")?.default_persona_slug).toBe(
      "marcus-okonkwo",
    );
    expect(findTemplateBySlug("perinatal-depression-en")?.default_persona_slug).toBe(
      "sofia-morales",
    );
    expect(
      findTemplateBySlug("adolescent-social-anxiety-en")?.default_persona_slug,
    ).toBe("tyler-bennett");
  });
});
