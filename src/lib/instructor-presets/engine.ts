/**
 * Instructor Preset Engine — resolve educational objectives → standardized patient.
 */

import {
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { createRng } from "@/lib/case-engine/generator";
import type {
  CaseInstanceSnapshot,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  findTemplateById,
  findTemplateBySlug,
  listBuiltinTemplates,
} from "@/lib/scenario-templates/catalog";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";
import {
  candidatesForObjectives,
  OBJECTIVE_DISORDER_CANDIDATES,
  OBJECTIVE_TEMPLATE_PREFERENCES,
} from "./objective-map";
import { findPresetById, findPresetBySlug } from "./catalog";
import type {
  InstructorPreset,
  LearningObjectiveKey,
  PresetResolution,
  PresetTimeLimit,
} from "./types";
import { assertPresetValid } from "./validation";

export type GenerateFromPresetInput = {
  preset: InstructorPreset;
  persona: PersonaRow;
  avatarId: string;
  /** Advanced Mode only — instructor may pin diagnosis. */
  disorderSlugOverride?: string;
  comorbiditySlugs?: string[];
  seed?: string | number;
  templates?: ClinicalScenarioTemplate[];
};

export type GeneratedAssessment = {
  snapshot: CaseInstanceSnapshot;
  resolution: PresetResolution;
  timeLimitMinutes: PresetTimeLimit;
  maxDurationSec: number;
  allowHints: boolean;
  allowPause: boolean;
  allowRestart: boolean;
  gradingMode: InstructorPreset["grading_mode"];
  feedbackMode: InstructorPreset["feedback_mode"];
};

export type GenerateFromPresetResult =
  | { ok: true; assessment: GeneratedAssessment }
  | { ok: false; issues: { code: string; message: string; path?: string }[] };

/** Time limit → pacing modifiers (disclosure speed, urgency, history depth). */
export function timeLimitModifiers(minutes: PresetTimeLimit): {
  disclosure_speed: "slow" | "moderate" | "fast" | "very_fast";
  conversation_pacing: "leisurely" | "steady" | "brisk" | "urgent";
  urgency: "low" | "moderate" | "high" | "critical";
  history_depth: "full" | "focused" | "brief" | "minimal";
} {
  if (minutes <= 10) {
    return {
      disclosure_speed: "very_fast",
      conversation_pacing: "urgent",
      urgency: "critical",
      history_depth: "minimal",
    };
  }
  if (minutes <= 20) {
    return {
      disclosure_speed: "fast",
      conversation_pacing: "brisk",
      urgency: "high",
      history_depth: "brief",
    };
  }
  if (minutes <= 30) {
    return {
      disclosure_speed: "moderate",
      conversation_pacing: "steady",
      urgency: "moderate",
      history_depth: "focused",
    };
  }
  if (minutes <= 45) {
    return {
      disclosure_speed: "moderate",
      conversation_pacing: "steady",
      urgency: "moderate",
      history_depth: "focused",
    };
  }
  return {
    disclosure_speed: "slow",
    conversation_pacing: "leisurely",
    urgency: "low",
    history_depth: "full",
  };
}

function applyConstraints(
  candidates: string[],
  preset: InstructorPreset,
): string[] {
  let list = [...candidates];
  const allowed = preset.clinical_constraints
    .filter((c) => c.constraint_type === "allowed_disorder")
    .map((c) => c.value);
  const excluded = new Set(
    preset.clinical_constraints
      .filter((c) => c.constraint_type === "excluded_disorder")
      .map((c) => c.value),
  );
  if (allowed.length) {
    list = list.filter((d) => allowed.includes(d));
  }
  list = list.filter((d) => !excluded.has(d));
  return list;
}

function pickDisorder(
  preset: InstructorPreset,
  rng: () => number,
  override?: string,
): { slug: string; rationale: string } | { error: string } {
  const catalog = getBuiltinCatalog();
  if (override) {
    if (!preset.advanced_mode) {
      return {
        error:
          "Diagnosis override requires Advanced Mode on the instructor preset",
      };
    }
    if (!findDisorderBySlug(override, catalog)) {
      return { error: `Unknown disorder override: ${override}` };
    }
    return {
      slug: override,
      rationale: `Advanced Mode override: ${override}`,
    };
  }

  let candidates = candidatesForObjectives(
    preset.primary_objective,
    preset.secondary_objectives,
  );
  candidates = applyConstraints(candidates, preset);
  candidates = candidates.filter((s) => findDisorderBySlug(s, catalog));

  if (!candidates.length) {
    const fallback =
      OBJECTIVE_DISORDER_CANDIDATES[preset.primary_objective] ?? [];
    candidates = applyConstraints(fallback, preset).filter((s) =>
      findDisorderBySlug(s, catalog),
    );
  }

  if (!candidates.length) {
    return {
      error: `No valid diagnosis candidates for objective ${preset.primary_objective}`,
    };
  }

  const slug = candidates[Math.floor(rng() * candidates.length)]!;
  return {
    slug,
    rationale: `Selected ${slug} from objectives [${preset.primary_objective}${
      preset.secondary_objectives.length
        ? ", " + preset.secondary_objectives.join(", ")
        : ""
    }]`,
  };
}

function pickTemplate(
  preset: InstructorPreset,
  disorderSlug: string,
  templates: ClinicalScenarioTemplate[],
  rng: () => number,
): ClinicalScenarioTemplate | null {
  const pool = templates.filter((t) => t.enabled);
  if (!pool.length) return null;

  // 1. Explicit pin
  if (preset.scenario_template_id) {
    const pinned =
      pool.find((t) => t.id === preset.scenario_template_id) ??
      findTemplateById(preset.scenario_template_id);
    if (pinned) return pinned;
  }
  if (preset.scenario_template_slug) {
    const pinned =
      pool.find((t) => t.slug === preset.scenario_template_slug) ??
      findTemplateBySlug(preset.scenario_template_slug);
    if (pinned) return pinned;
  }

  // 2. Preferred slugs that match language + diagnosis when possible
  const preferred = [
    ...preset.preferred_template_slugs,
    ...(OBJECTIVE_TEMPLATE_PREFERENCES[preset.primary_objective] ?? []),
  ];
  const byPref = preferred
    .map((s) => pool.find((t) => t.slug === s) ?? findTemplateBySlug(s))
    .filter(Boolean) as ClinicalScenarioTemplate[];

  const langMatch = (t: ClinicalScenarioTemplate) => {
    const pl = preset.language.slice(0, 2).toLowerCase();
    return t.language.toLowerCase().startsWith(pl);
  };

  const exactDx = byPref.filter(
    (t) => t.primary_diagnosis_slug === disorderSlug && langMatch(t),
  );
  if (exactDx.length) {
    return exactDx[Math.floor(rng() * exactDx.length)]!;
  }

  const langPref = byPref.filter(langMatch);
  if (langPref.length) {
    return langPref[Math.floor(rng() * langPref.length)]!;
  }
  if (byPref.length) {
    return byPref[Math.floor(rng() * byPref.length)]!;
  }

  // 3. Any template matching language + diagnosis
  const matchDxLang = pool.filter(
    (t) => t.primary_diagnosis_slug === disorderSlug && langMatch(t),
  );
  if (matchDxLang.length) {
    return matchDxLang[Math.floor(rng() * matchDxLang.length)]!;
  }

  const matchLang = pool.filter(langMatch);
  if (matchLang.length) {
    return matchLang[Math.floor(rng() * matchLang.length)]!;
  }

  return pool[Math.floor(rng() * pool.length)]!;
}

function overlayTemplateForDiagnosis(
  template: ClinicalScenarioTemplate,
  disorderSlug: string,
  preset: InstructorPreset,
): ClinicalScenarioTemplate {
  const disorder = findDisorderBySlug(disorderSlug);
  if (!disorder) return template;

  const forbidden = new Set(
    preset.clinical_constraints
      .filter((c) => c.constraint_type === "forbidden_comorbidity")
      .map((c) => c.value),
  );

  return {
    ...template,
    primary_diagnosis_id: disorder.id,
    primary_diagnosis_slug: disorder.slug,
    difficulty: preset.difficulty,
    language: preset.language,
    culture: preset.culture ?? template.culture,
    therapy_modality:
      preset.therapy_modality === "medication_management"
        ? "supportive"
        : (preset.therapy_modality as ClinicalScenarioTemplate["therapy_modality"]),
    estimated_duration_minutes: preset.time_limit_minutes,
    randomization_level: preset.randomization_level,
    assessment_type: preset.assessment_type,
    allowed_comorbidity_slugs: template.allowed_comorbidity_slugs.filter(
      (s) => !forbidden.has(s) && s !== disorderSlug,
    ),
    grading_rubric: {
      pass_threshold: preset.grading.pass_threshold,
      outstanding_threshold: preset.grading.outstanding_threshold,
      critical_mistakes: preset.grading.critical_mistakes,
      automatic_deductions: preset.grading.automatic_deductions,
    },
    learning_objectives: [
      {
        category: "clinical_competency" as const,
        statement: `Primary objective: ${preset.primary_objective.replace(/_/g, " ")}`,
      },
      ...preset.secondary_objectives.map((o: LearningObjectiveKey) => ({
        category: "skills" as const,
        statement: `Secondary objective: ${o.replace(/_/g, " ")}`,
      })),
      ...template.learning_objectives,
    ],
    clinical_competencies:
      preset.required_competencies.length ||
      preset.optional_competencies.length
        ? [
            ...preset.required_competencies.map((c, i) => ({
              competency_id: c.competency_id,
              label: c.label,
              weight: c.weight,
              max_score: c.max_score,
              critical: c.required,
              sort_order: i,
            })),
            ...preset.optional_competencies.map((c, i) => ({
              competency_id: c.competency_id,
              label: c.label,
              weight: c.weight,
              max_score: c.max_score,
              critical: false,
              sort_order: 100 + i,
            })),
          ]
        : template.clinical_competencies,
  };
}

/**
 * Resolve preset → diagnosis + template (no patient generation yet).
 */
export function resolvePreset(
  preset: InstructorPreset,
  opts?: {
    seed?: string | number;
    disorderSlugOverride?: string;
    templates?: ClinicalScenarioTemplate[];
  },
):
  | { ok: true; resolution: PresetResolution }
  | { ok: false; issues: { code: string; message: string }[] } {
  try {
    assertPresetValid(preset);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_preset",
          message: e instanceof Error ? e.message : "Invalid preset",
        },
      ],
    };
  }

  const rng = createRng(
    opts?.seed ?? `${preset.slug}:${preset.version}:${Date.now()}`,
  );
  const picked = pickDisorder(preset, rng, opts?.disorderSlugOverride);
  if ("error" in picked) {
    return {
      ok: false,
      issues: [{ code: "diagnosis_selection", message: picked.error }],
    };
  }

  const templates = opts?.templates?.length
    ? opts.templates
    : listBuiltinTemplates();
  const template = pickTemplate(preset, picked.slug, templates, rng);
  if (!template) {
    return {
      ok: false,
      issues: [
        {
          code: "template_missing",
          message: "No clinical scenario template available for preset",
        },
      ],
    };
  }

  return {
    ok: true,
    resolution: {
      preset,
      selectedDisorderSlug: picked.slug,
      selectedTemplateSlug: template.slug,
      comorbiditySlugs: [],
      rationale: `${picked.rationale}; template=${template.slug}`,
    },
  };
}

/**
 * Full pipeline: objectives → diagnosis → template → standardized patient.
 */
export function generateFromPreset(
  input: GenerateFromPresetInput,
): GenerateFromPresetResult {
  const { preset, persona, avatarId } = input;
  const resolved = resolvePreset(preset, {
    seed: input.seed,
    disorderSlugOverride: input.disorderSlugOverride,
    templates: input.templates,
  });
  if (!resolved.ok) return resolved;

  const { resolution } = resolved;
  const baseTemplate =
    findTemplateBySlug(resolution.selectedTemplateSlug) ??
    input.templates?.find((t) => t.slug === resolution.selectedTemplateSlug);
  if (!baseTemplate) {
    return {
      ok: false,
      issues: [
        {
          code: "template_missing",
          message: `Template not found: ${resolution.selectedTemplateSlug}`,
        },
      ],
    };
  }

  const template = overlayTemplateForDiagnosis(
    baseTemplate,
    resolution.selectedDisorderSlug,
    preset,
  );

  const fromTemplate = generateFromTemplate({
    template,
    persona,
    avatarId,
    comorbiditySlugs: input.comorbiditySlugs,
    seed: input.seed ?? `${preset.slug}:${persona.slug}:${Date.now()}`,
    autoComorbidity:
      !input.comorbiditySlugs?.length &&
      preset.randomization_level !== "none",
  });

  if (!fromTemplate.ok) return fromTemplate;

  const pacing = timeLimitModifiers(preset.time_limit_minutes);
  const therapyNote =
    preset.therapy_modality === "medication_management"
      ? "Patient expects clear medication counseling; react to abrupt med changes with concern."
      : `Therapy modality context: ${preset.therapy_modality}. Adapt affect and cooperation to modality-appropriate interventions.`;

  const snapshot: CaseInstanceSnapshot = {
    ...fromTemplate.patient.snapshot,
    difficulty: preset.difficulty,
    locale: preset.language,
    therapy_modality:
      preset.therapy_modality === "medication_management"
        ? "supportive"
        : (preset.therapy_modality as TherapyModality),
    template: fromTemplate.patient.template,
    clinical_core: {
      ...fromTemplate.patient.snapshot.clinical_core,
      ideal_approach: [
        fromTemplate.patient.snapshot.clinical_core.ideal_approach,
        therapyNote,
        `Instructor preset: ${preset.name} (${preset.slug} v${preset.version}).`,
        `Target learner: ${preset.target_learner}; level: ${preset.learning_level}.`,
        `Time limit ${preset.time_limit_minutes} min → disclosure ${pacing.disclosure_speed}, pacing ${pacing.conversation_pacing}, urgency ${pacing.urgency}, history ${pacing.history_depth}.`,
        `Grading: ${preset.grading_mode}; feedback: ${preset.feedback_mode}; hints: ${preset.allow_hints ? "allowed" : "disabled"}.`,
        `Objectives: ${preset.primary_objective}` +
          (preset.secondary_objectives.length
            ? `; ${preset.secondary_objectives.join(", ")}`
            : ""),
        `Selection rationale: ${resolution.rationale}.`,
      ].join(" "),
    },
    instructor_preset: {
      id: preset.id,
      slug: preset.slug,
      version: preset.version,
      name: preset.name,
      primary_objective: preset.primary_objective,
      secondary_objectives: preset.secondary_objectives,
      target_learner: preset.target_learner,
      assessment_type: preset.assessment_type,
      grading_mode: preset.grading_mode,
      feedback_mode: preset.feedback_mode,
      time_limit_minutes: preset.time_limit_minutes,
      allow_hints: preset.allow_hints,
      allow_pause: preset.allow_pause,
      allow_restart: preset.allow_restart,
      voice_enabled: preset.voice_enabled,
      culture: preset.culture,
      pacing,
      rationale: resolution.rationale,
    },
  };

  // Ensure diagnosis matches engine selection (never mutated by safe randomization)
  if (snapshot.primary_diagnosis.slug !== resolution.selectedDisorderSlug) {
    return {
      ok: false,
      issues: [
        {
          code: "diagnosis_mismatch",
          message: `Generated diagnosis ${snapshot.primary_diagnosis.slug} != selected ${resolution.selectedDisorderSlug}`,
        },
      ],
    };
  }

  return {
    ok: true,
    assessment: {
      snapshot,
      resolution,
      timeLimitMinutes: preset.time_limit_minutes,
      maxDurationSec: preset.time_limit_minutes * 60,
      allowHints: preset.allow_hints,
      allowPause: preset.allow_pause,
      allowRestart: preset.allow_restart,
      gradingMode: preset.grading_mode,
      feedbackMode: preset.feedback_mode,
    },
  };
}

export function resolvePresetRef(opts: {
  presetId?: string;
  presetSlug?: string;
}): InstructorPreset | null {
  if (opts.presetId) {
    return findPresetById(opts.presetId) ?? null;
  }
  if (opts.presetSlug) {
    return findPresetBySlug(opts.presetSlug) ?? null;
  }
  return null;
}
