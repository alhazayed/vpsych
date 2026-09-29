import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authoredTherapyCuesFor } from "@/lib/case-engine/authored-therapy-cues";
import { WAVE2_THERAPY_CUES } from "@/lib/case-engine/authored-therapy-cues-wave2";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { getBuiltinPersonality } from "@/lib/personality-engine/catalog";
import { validateHumanPersonality } from "@/lib/personality-engine/validation";

const WAVE2_SLUGS = Object.keys(WAVE2_THERAPY_CUES);

describe("Wave-2 Simulated Patient Library", () => {
  it("reaches 50 total indexed cases with 38 Wave-2 additions", () => {
    const index = JSON.parse(
      readFileSync(join(process.cwd(), "personas/index.json"), "utf8"),
    ) as {
      cases: Array<{
        slug: string;
        library_wave?: number;
        difficulty?: string;
      }>;
      _meta?: { wave2?: { added?: number } };
    };
    expect(index.cases.length).toBe(50);
    expect(index._meta?.wave2?.added).toBe(38);
    expect(WAVE2_SLUGS.length).toBe(38);
    for (const slug of WAVE2_SLUGS) {
      expect(index.cases.some((c) => c.slug === slug)).toBe(true);
    }
  });

  it("authors bilingual cases with expanded educational packs", () => {
    for (const slug of WAVE2_SLUGS) {
      const caseJson = JSON.parse(
        readFileSync(join(process.cwd(), "personas", `${slug}.case.json`), "utf8"),
      ) as {
        _meta: {
          faculty_guide?: { setup?: string };
          debrief_guide?: { take_home?: string };
          references?: string[];
          scoring_expectations?: { pass_threshold?: number };
          supervisor_teaching_notes?: string[];
          difficulty_level?: string;
        };
        personalities: Record<string, { authored_natively?: boolean }>;
        clinical_core: {
          case_file?: {
            education?: { faculty_guide?: unknown };
            psychiatric_history?: { developmental_history?: string };
            mental_state_examination?: { insight?: string; judgement?: string };
          };
        };
      };
      expect(caseJson.personalities["en-US"]?.authored_natively).toBe(true);
      expect(caseJson.personalities["ar-JO"]?.authored_natively).toBe(true);
      expect(caseJson._meta.faculty_guide?.setup).toBeTruthy();
      expect(caseJson._meta.debrief_guide?.take_home).toBeTruthy();
      expect(caseJson._meta.references?.length).toBeGreaterThan(1);
      expect(caseJson._meta.scoring_expectations?.pass_threshold).toBeGreaterThan(0);
      expect(caseJson._meta.supervisor_teaching_notes?.length).toBeGreaterThan(2);
      expect(
        caseJson.clinical_core.case_file?.mental_state_examination?.insight,
      ).toBeTruthy();
      expect(
        caseJson.clinical_core.case_file?.mental_state_examination?.judgement,
      ).toBeTruthy();
    }
  });

  it("covers multiple difficulty lanes", () => {
    const index = JSON.parse(
      readFileSync(join(process.cwd(), "personas/index.json"), "utf8"),
    ) as { cases: Array<{ library_wave?: number; difficulty?: string }> };
    const diffs = new Set(
      index.cases
        .filter((c) => c.library_wave === 2)
        .map((c) => c.difficulty)
        .filter(Boolean),
    );
    for (const lane of [
      "beginner",
      "intermediate",
      "advanced",
      "expert",
      "osce",
      "emergency",
      "longitudinal",
    ]) {
      expect(diffs.has(lane), `missing difficulty lane ${lane}`).toBe(true);
    }
  });

  it("wires therapy cues, valid personalities, and disorder packages", () => {
    for (const slug of WAVE2_SLUGS) {
      expect(authoredTherapyCuesFor(slug)?.process_lines.length).toBeGreaterThan(4);
      const en = getBuiltinPersonality(slug, "en-US");
      const ar = getBuiltinPersonality(slug, "ar-JO");
      expect(en).not.toBeNull();
      expect(ar).not.toBeNull();
      expect(validateHumanPersonality(en).ok, `${slug}/en-US`).toBe(true);
      expect(validateHumanPersonality(ar).ok, `${slug}/ar-JO`).toBe(true);
    }
    for (const slug of ["pdd", "asd", "schizoaffective", "panic-disorder", "delirium"]) {
      expect(BUILTIN_DISORDERS.some((d) => d.slug === slug && d.is_active)).toBe(
        true,
      );
    }
  });
});
