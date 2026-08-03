import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILTIN_PRESETS,
  listBuiltinPresets,
} from "@/lib/instructor-presets/catalog";
import { generateFromPreset } from "@/lib/instructor-presets/engine";
import type { PersonaRow } from "@/lib/case-engine/types";
import { getBuiltinGraph } from "@/lib/cge/graph";

const root = join(process.cwd(), "src");

const persona: PersonaRow = {
  id: "00000000-0000-4000-8000-000000000030",
  avatar_id: "00000000-0000-4000-8000-000000000031",
  slug: "preset-cert",
  display_name: "Preset Cert",
  identity: { age: 30, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
};

const REQUIRED_LEARNERS = [
  "medical_student",
  "psychiatry_resident",
  "general_practitioner",
  "psychologist",
  "counselor",
  "consultant_psychiatrist",
] as const;

describe("Instructor Presets certification guards", () => {
  it("covers required CBME learner types", () => {
    const learners = new Set(
      listBuiltinPresets().map((p) => p.target_learner),
    );
    for (const learner of REQUIRED_LEARNERS) {
      expect(learners.has(learner), learner).toBe(true);
    }
    expect(listBuiltinPresets().length).toBeGreaterThanOrEqual(6);
  });

  it("aligns required competencies to CGE graph node ids", () => {
    const graphIds = new Set(getBuiltinGraph().nodes.map((n) => n.id));
    for (const preset of listBuiltinPresets()) {
      for (const c of [
        ...preset.required_competencies,
        ...preset.optional_competencies,
      ]) {
        expect(
          graphIds.has(c.competency_id as never),
          `${preset.slug}:${c.competency_id}`,
        ).toBe(true);
      }
    }
  });

  it("does not pin a mismatched diagnosis template over the selected disorder", () => {
    const base = BUILTIN_PRESETS.find(
      (p) => p.slug === "suicide-risk-resident-en",
    )!;
    // Advanced Mode enables diagnosis override so we can prove the Critical
    // binding rule: pinned template is ignored when its primary_diagnosis
    // does not match the selected disorder.
    const advanced = { ...base, advanced_mode: true };

    const mdd = generateFromPreset({
      preset: advanced,
      persona,
      avatarId: persona.avatar_id!,
      seed: "suicide-bind-mdd",
      disorderSlugOverride: "mdd-recurrent-moderate",
    });
    expect(mdd.ok, JSON.stringify(mdd)).toBe(true);
    if (mdd.ok) {
      expect(mdd.assessment.resolution.selectedDisorderSlug).toBe(
        "mdd-recurrent-moderate",
      );
      expect(mdd.assessment.resolution.selectedTemplateSlug).toBe(
        "adult-mdd-initial-en",
      );
      expect(mdd.assessment.resolution.selectedTemplateSlug).not.toBe(
        "ptsd-risk-assessment-en",
      );
    }

    const ptsd = generateFromPreset({
      preset: advanced,
      persona,
      avatarId: persona.avatar_id!,
      seed: "suicide-bind-ptsd",
      disorderSlugOverride: "ptsd",
    });
    expect(ptsd.ok, JSON.stringify(ptsd)).toBe(true);
    if (ptsd.ok) {
      expect(ptsd.assessment.resolution.selectedDisorderSlug).toBe("ptsd");
      expect(ptsd.assessment.resolution.selectedTemplateSlug).toBe(
        "ptsd-risk-assessment-en",
      );
    }

    if (mdd.ok && ptsd.ok) {
      expect(mdd.assessment.resolution.selectedTemplateSlug).not.toBe(
        ptsd.assessment.resolution.selectedTemplateSlug,
      );
    }
  });

  it("produces distinct educational signatures across enabled presets", () => {
    const signatures = new Set<string>();
    for (const preset of listBuiltinPresets()) {
      const result = generateFromPreset({
        preset,
        persona,
        avatarId: persona.avatar_id!,
        seed: `sig-${preset.slug}`,
      });
      expect(result.ok, preset.slug).toBe(true);
      if (!result.ok) continue;
      const a = result.assessment;
      const sig = [
        preset.slug,
        preset.target_learner,
        preset.primary_objective,
        preset.difficulty,
        String(preset.time_limit_minutes),
        a.resolution.selectedDisorderSlug,
        a.resolution.selectedTemplateSlug,
        a.gradingMode,
        a.feedbackMode,
        a.allowHints ? "hints" : "nohints",
      ].join("|");
      signatures.add(sig);
    }
    expect(signatures.size).toBe(listBuiltinPresets().length);
  });

  it("sanitizes preset version/clone DB errors and copies template/constraint children", () => {
    const route = readFileSync(
      join(root, "app/api/admin/presets/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/sanitizeDbError\(verErr\.message\)/);
    expect(route).toMatch(/sanitizeDbError\(cloneErr/);
    expect(route).toMatch(/preset_templates/);
    expect(route).toMatch(/preset_constraints/);
  });

  it("preview rejects DB-only presets without crashing on undefined spread", () => {
    const preview = readFileSync(
      join(root, "app/api/admin/presets/preview/route.ts"),
      "utf8",
    );
    expect(preview).not.toMatch(/findPresetBySlug\(data\.slug\)!/);
    expect(preview).toMatch(/status: 422/);
  });
});
