import { getBuiltinCatalog } from "@/lib/case-engine/catalog";
import type { CaseValidationIssue } from "@/lib/case-engine/types";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";

function issue(code: string, message: string, path?: string): CaseValidationIssue {
  return { code, message, path };
}

const VALID_THERAPIES = new Set([
  "cbt",
  "dbt",
  "act",
  "psychodynamic",
  "supportive",
  "motivational_interviewing",
  "family_therapy",
  "crisis_intervention",
  "exposure_therapy",
]);

/**
 * Validate a Clinical Scenario Template before generation.
 */
export function validateTemplate(
  template: ClinicalScenarioTemplate,
): { ok: true } | { ok: false; issues: CaseValidationIssue[] } {
  const issues: CaseValidationIssue[] = [];
  const catalog = getBuiltinCatalog();

  if (!template.enabled) {
    issues.push(issue("template_disabled", "Template is disabled", "enabled"));
  }
  if (!template.name?.trim()) {
    issues.push(issue("template_name_missing", "Template name required", "name"));
  }
  if (!template.learning_objectives?.length) {
    issues.push(
      issue(
        "objectives_missing",
        "At least one learning objective required",
        "learning_objectives",
      ),
    );
  }
  if (!template.clinical_competencies?.length) {
    issues.push(
      issue(
        "competencies_missing",
        "At least one clinical competency required",
        "clinical_competencies",
      ),
    );
  }
  if (
    template.grading_rubric.pass_threshold == null ||
    template.grading_rubric.outstanding_threshold == null
  ) {
    issues.push(
      issue("grading_incomplete", "Pass/outstanding thresholds required", "grading_rubric"),
    );
  }
  if (
    template.grading_rubric.pass_threshold >=
    template.grading_rubric.outstanding_threshold
  ) {
    issues.push(
      issue(
        "grading_thresholds",
        "Pass threshold must be below outstanding threshold",
        "grading_rubric",
      ),
    );
  }

  const primarySlug = template.primary_diagnosis_slug;
  const primary = primarySlug
    ? catalog.disorders.find((d) => d.slug === primarySlug)
    : catalog.disorders.find((d) => d.id === template.primary_diagnosis_id);

  if (!primary?.is_active) {
    issues.push(
      issue("primary_diagnosis_invalid", "Primary diagnosis missing or inactive", "primary_diagnosis"),
    );
  } else {
    if (!primary.dsm5_code && !primary.package?.dsm5_optional) {
      issues.push(issue("dsm5_missing", "Primary diagnosis missing DSM-5", "primary_diagnosis"));
    }
    if (!primary.icd11_code) {
      issues.push(issue("icd11_missing", "Primary diagnosis missing ICD-11", "primary_diagnosis"));
    }
  }

  if (!VALID_THERAPIES.has(template.therapy_modality)) {
    issues.push(
      issue(
        "therapy_unsupported",
        `Unsupported therapy modality: ${template.therapy_modality}`,
        "therapy_modality",
      ),
    );
  }

  for (const slug of template.allowed_comorbidity_slugs ?? []) {
    if (template.excluded_diagnosis_slugs?.includes(slug)) {
      issues.push(
        issue(
          "comorbidity_also_excluded",
          `Comorbidity ${slug} is also excluded`,
          "allowed_comorbidities",
        ),
      );
    }
    if (slug === primarySlug) {
      issues.push(
        issue(
          "comorbidity_equals_primary",
          `Comorbidity ${slug} duplicates primary`,
          "allowed_comorbidities",
        ),
      );
    }
    const comorbid = catalog.disorders.find((d) => d.slug === slug);
    if (!comorbid) {
      issues.push(
        issue("comorbidity_unknown", `Unknown comorbidity ${slug}`, "allowed_comorbidities"),
      );
      continue;
    }
    if (primary) {
      const rule = catalog.comorbidityRules.find(
        (r) =>
          r.primary_disorder_id === primary.id &&
          r.comorbid_disorder_id === comorbid.id,
      );
      if (rule && (!rule.compatible || rule.tier === "impossible")) {
        // Allowed only for medical simulation + delirium
        if (
          !(
            template.allow_medical_simulation &&
            (slug === "delirium" || primary.slug === "delirium")
          )
        ) {
          issues.push(
            issue(
              "unsafe_comorbidity",
              `Impossible comorbidity on template: ${primary.slug} + ${slug}`,
              "allowed_comorbidities",
            ),
          );
        }
      }
    }
  }

  if (!/^[a-z]{2}(-[A-Z]{2})?$/i.test(template.language)) {
    issues.push(issue("locale_invalid", `Invalid language: ${template.language}`, "language"));
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
