import {
  findDisorderBySlug,
  findDifficulty,
  findTherapy,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type {
  CaseInstanceSnapshot,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  competenciesToRubricItems,
  templateSeverityToCaseSeverity,
  type ClinicalScenarioTemplate,
} from "@/lib/scenario-templates/types";
import { validateTemplate } from "@/lib/scenario-templates/validation";
import { createRng } from "@/lib/case-engine/generator";

export type GenerateFromTemplateInput = {
  template: ClinicalScenarioTemplate;
  persona: PersonaRow;
  avatarId: string;
  /** Optional comorbidity override (must be in template allowed list). */
  comorbiditySlugs?: string[];
  seed?: string | number;
  /** Pick a random allowed comorbidity when randomization permits. */
  autoComorbidity?: boolean;
};

export type GeneratedStandardizedPatient = {
  snapshot: CaseInstanceSnapshot;
  template: {
    id: string;
    slug: string;
    version: number;
    name: string;
    specialty: string;
    assessment_type: string;
    learning_objectives: ClinicalScenarioTemplate["learning_objectives"];
    grading_rubric: ClinicalScenarioTemplate["grading_rubric"];
    report_template: ClinicalScenarioTemplate["report_template"];
    culture: string | null | undefined;
    risk_level: string;
    memory_mode: string;
  };
};

export type GenerateFromTemplateResult =
  | { ok: true; patient: GeneratedStandardizedPatient }
  | { ok: false; issues: { code: string; message: string; path?: string }[] };

/**
 * Clinical Scenario Template → Standardized Patient (CaseInstance).
 */
export function generateFromTemplate(
  input: GenerateFromTemplateInput,
): GenerateFromTemplateResult {
  const { template, persona, avatarId } = input;
  const catalog = getBuiltinCatalog();

  const templateValidation = validateTemplate(template);
  if (!templateValidation.ok) return templateValidation;

  const primarySlug = template.primary_diagnosis_slug!;
  const primary = findDisorderBySlug(primarySlug, catalog);
  if (!primary) {
    return {
      ok: false,
      issues: [
        {
          code: "primary_missing",
          message: `Primary disorder not found: ${primarySlug}`,
        },
      ],
    };
  }

  const rng = createRng(
    input.seed ?? `${template.slug}:${persona.slug}:${Date.now()}`,
  );

  let comorbiditySlugs = [...(input.comorbiditySlugs ?? [])];

  // Reject excluded
  for (const slug of comorbiditySlugs) {
    if (template.excluded_diagnosis_slugs.includes(slug)) {
      return {
        ok: false,
        issues: [
          {
            code: "excluded_diagnosis",
            message: `Diagnosis excluded by template: ${slug}`,
            path: "comorbidities",
          },
        ],
      };
    }
    if (!template.allowed_comorbidity_slugs.includes(slug)) {
      return {
        ok: false,
        issues: [
          {
            code: "comorbidity_not_allowed",
            message: `Comorbidity not allowed by template: ${slug}`,
            path: "comorbidities",
          },
        ],
      };
    }
  }

  if (
    comorbiditySlugs.length === 0 &&
    input.autoComorbidity !== false &&
    template.randomization_level !== "none" &&
    template.allowed_comorbidity_slugs.length > 0 &&
    rng() > 0.55
  ) {
    const pick =
      template.allowed_comorbidity_slugs[
        Math.floor(rng() * template.allowed_comorbidity_slugs.length)
      ]!;
    comorbiditySlugs = [pick];
  }

  const comorbidities = comorbiditySlugs
    .map((s) => findDisorderBySlug(s, catalog))
    .filter(Boolean) as NonNullable<ReturnType<typeof findDisorderBySlug>>[];

  const therapyModality = template.therapy_modality as TherapyModality;
  const difficulty = template.difficulty;
  const severity = templateSeverityToCaseSeverity(template.severity);

  // Apply severity into clinical via request severity
  const generated = generateCaseInstance({
    persona,
    avatarId,
    primaryDisorder: primary,
    comorbidities,
    difficulty,
    therapyModality,
    locale: template.language,
    severity,
    seed: input.seed ?? `${template.slug}:${persona.slug}:${rng()}`,
    difficultyProfile: findDifficulty(difficulty, catalog),
    therapyProfile: findTherapy(therapyModality, catalog),
  });

  if (!generated.ok) return generated;

  const snapshot: CaseInstanceSnapshot = {
    ...generated.snapshot,
    rubric: competenciesToRubricItems(template.clinical_competencies),
    memory_scope:
      template.memory_mode === "longitudinal"
        ? "case_instance"
        : "case_instance",
    clinical_core: {
      ...generated.snapshot.clinical_core,
      severity,
      ideal_approach: [
        generated.snapshot.clinical_core.ideal_approach,
        `Assessment type: ${template.assessment_type}.`,
        `Specialty: ${template.specialty}.`,
        `Culture context: ${template.culture ?? "unspecified"}.`,
        `Risk level target: ${template.risk_level}.`,
        `Learning objectives: ${template.learning_objectives.map((o) => o.statement).join("; ")}`,
      ].join(" "),
    },
  };

  // Severity intensity note (does not alter DSM criteria — guides presentation)
  if (template.severity === "very_severe" || template.severity === "severe") {
    snapshot.clinical_core.ideal_approach +=
      " Presentation intensity is high: speech may be sparse or pressured; affect constricted or labile; insight reduced.";
  } else if (template.severity === "minimal" || template.severity === "mild") {
    snapshot.clinical_core.ideal_approach +=
      " Presentation intensity is milder: more organised speech, partial functioning preserved.";
  }

  return {
    ok: true,
    patient: {
      snapshot,
      template: {
        id: template.id,
        slug: template.slug,
        version: template.version,
        name: template.name,
        specialty: template.specialty,
        assessment_type: template.assessment_type,
        learning_objectives: template.learning_objectives,
        grading_rubric: template.grading_rubric,
        report_template: template.report_template,
        culture: template.culture,
        risk_level: template.risk_level,
        memory_mode: template.memory_mode,
      },
    },
  };
}
