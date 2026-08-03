/**
 * Mission 17 — Clinical Scenario Certification scoring.
 * Scores each disorder package and each scenario template independently.
 */

import type { DisorderRow } from "@/lib/case-engine/types";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";
import type { InstructorPreset } from "@/lib/instructor-presets/types";
import { clinicalCuesForDisorder } from "@/lib/clinical/scenario-cues";

export type ScenarioScores = {
  clinical_fidelity_index: number;
  simulation_realism: number;
  diagnostic_accuracy: number;
  educational_value: number;
  language_fidelity: number;
  overall: number;
};

export type ScenarioVerdict =
  | "SCENARIO_FAILED"
  | "SCENARIO_CERTIFIED_WITH_RECOMMENDATIONS"
  | "SCENARIO_CERTIFIED";

export type Finding = {
  severity: "Critical" | "High" | "Medium" | "Low";
  code: string;
  message: string;
};

export type DisorderCertification = {
  slug: string;
  name: string;
  dsm5_code: string | null;
  icd11_code: string | null;
  scores: ScenarioScores;
  findings: Finding[];
  verdict: ScenarioVerdict;
  checks: Record<string, boolean>;
};

export type TemplateCertification = {
  slug: string;
  name: string;
  language: string;
  primary_diagnosis_slug: string;
  scores: ScenarioScores;
  findings: Finding[];
  verdict: ScenarioVerdict;
};

export type PresetCertification = {
  slug: string;
  name: string;
  language: string;
  scores: ScenarioScores;
  findings: Finding[];
  verdict: ScenarioVerdict;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function verdictFromScore(
  overall: number,
  findings: Finding[],
): ScenarioVerdict {
  const critical = findings.some((f) => f.severity === "Critical");
  const highCount = findings.filter((f) => f.severity === "High").length;
  if (critical || overall < 70) return "SCENARIO_FAILED";
  if (highCount > 0 || overall < 90) return "SCENARIO_CERTIFIED_WITH_RECOMMENDATIONS";
  return "SCENARIO_CERTIFIED";
}

/** Minimum symptom count by category for credible MSE portrayal. */
function minSymptoms(slug: string): number {
  if (slug === "schizophrenia" || slug === "schizoaffective") return 3;
  if (slug === "bipolar-mania" || slug === "complex-ptsd" || slug === "bpd") return 3;
  if (slug === "mdd-recurrent-moderate" || slug === "ptsd" || slug === "ocd") return 3;
  return 2;
}

export function certifyDisorder(disorder: DisorderRow): DisorderCertification {
  const pkg = disorder.package ?? {};
  const findings: Finding[] = [];
  const symptoms = pkg.symptom_profile ?? [];
  const diffs = pkg.differentials ?? [];
  const rules = pkg.rule_outs ?? [];
  const teaching = pkg.teaching_points ?? [];
  const mistakes = pkg.common_therapist_mistakes ?? [];
  const risk = pkg.risk_defaults ?? {};
  const cues = clinicalCuesForDisorder(disorder.slug);

  const checks: Record<string, boolean> = {
    has_icd11: Boolean(disorder.icd11_code),
    has_dsm5_or_optional:
      Boolean(disorder.dsm5_code) || Boolean(pkg.dsm5_optional),
    has_symptoms: symptoms.length >= minSymptoms(disorder.slug),
    has_differentials: diffs.length >= 2,
    has_rule_outs: rules.length >= 1,
    has_teaching: teaching.length >= 1,
    has_mistakes: mistakes.length >= 1,
    has_session_goals: (pkg.session_goals ?? []).length >= 2,
    has_disclosure: (pkg.disclosure_rules ?? []).length >= 1,
    has_ideal_approach: Boolean(pkg.ideal_approach),
    risk_si_defined: risk.suicidal_ideation !== undefined,
    risk_self_harm_defined: risk.self_harm !== undefined,
    risk_harm_others_defined: risk.harm_to_others !== undefined,
    age_bounds: disorder.min_age != null && disorder.max_age != null,
    cues_present: cues.mse_focus.length >= 3,
  };

  // Coding integrity
  if (!checks.has_icd11) {
    findings.push({
      severity: "Critical",
      code: "missing_icd11",
      message: "Missing ICD-11 code",
    });
  }
  if (!checks.has_dsm5_or_optional) {
    findings.push({
      severity: "Critical",
      code: "missing_dsm5",
      message: "Missing DSM-5 code without dsm5_optional flag",
    });
  }
  if (disorder.slug === "complex-ptsd" && disorder.dsm5_code === "309.81") {
    findings.push({
      severity: "Critical",
      code: "cptsd_dsm_ptsd",
      message: "CPTSD must not be coded as DSM-5 PTSD 309.81",
    });
  }
  if (disorder.slug === "bipolar-mania" && disorder.icd11_code === "6A60.1") {
    findings.push({
      severity: "Critical",
      code: "bipolar_icd_mismatch",
      message: "Psychotic mania must not use ICD-11 6A60.1",
    });
  }
  if (disorder.slug === "pdd" && disorder.icd11_code === "6A71.0") {
    findings.push({
      severity: "Critical",
      code: "pdd_icd_mismatch",
      message: "PDD must use ICD-11 6A72",
    });
  }

  if (!checks.has_symptoms) {
    findings.push({
      severity: "High",
      code: "thin_symptoms",
      message: `Symptom profile thinner than clinical minimum (${symptoms.length}/${minSymptoms(disorder.slug)})`,
    });
  }
  if (!checks.has_differentials) {
    findings.push({
      severity: "High",
      code: "missing_differentials",
      message: "Fewer than 2 differentials",
    });
  }
  if (!checks.has_teaching) {
    findings.push({
      severity: "Medium",
      code: "missing_teaching",
      message: "No teaching points",
    });
  }
  if (!checks.has_mistakes) {
    findings.push({
      severity: "Medium",
      code: "missing_mistakes",
      message: "No common therapist mistakes listed",
    });
  }
  if (!checks.has_rule_outs) {
    findings.push({
      severity: "Medium",
      code: "missing_rule_outs",
      message: "No explicit rule-outs",
    });
  }
  if (!checks.risk_si_defined) {
    findings.push({
      severity: "High",
      code: "risk_si_undefined",
      message: "suicidal_ideation default not explicit",
    });
  }
  if (!checks.risk_self_harm_defined || !checks.risk_harm_others_defined) {
    findings.push({
      severity: "Medium",
      code: "risk_flags_implicit",
      message: "self_harm / harm_to_others not explicitly set (generator defaults apply)",
    });
  }
  if (!checks.age_bounds) {
    findings.push({
      severity: "Medium",
      code: "age_bounds",
      message: "Missing min/max age bounds",
    });
  }

  // Domain scores
  let diagnostic = 100;
  if (!checks.has_icd11) diagnostic -= 40;
  if (!checks.has_dsm5_or_optional) diagnostic -= 30;
  if (!checks.has_differentials) diagnostic -= 15;
  if (!checks.has_rule_outs) diagnostic -= 8;

  let cfi = 100;
  if (!checks.has_symptoms) cfi -= 25;
  if (!checks.has_disclosure) cfi -= 10;
  if (!checks.has_session_goals) cfi -= 8;
  if (!checks.risk_si_defined) cfi -= 15;
  if (!checks.risk_self_harm_defined) cfi -= 5;
  if (!checks.risk_harm_others_defined) cfi -= 5;
  if (!checks.age_bounds) cfi -= 5;
  // Schizophrenia single-symptom was a known High defect
  if (disorder.slug === "schizophrenia" && symptoms.length < 3) cfi -= 10;

  let realism = 85;
  if (symptoms.length >= minSymptoms(disorder.slug) + 1) realism += 5;
  if ((pkg.disclosure_rules ?? []).length >= 2) realism += 5;
  if (!checks.has_ideal_approach) realism -= 15;
  if (findings.some((f) => f.severity === "Critical")) realism -= 30;

  let educational = 80;
  if (checks.has_teaching) educational += 8;
  if (checks.has_mistakes) educational += 6;
  if (checks.has_differentials) educational += 6;
  if (!checks.has_teaching && !checks.has_mistakes) educational -= 20;

  // Language fidelity of package text (English catalog; AR comes from personas/templates)
  const language = 88;

  const scores: ScenarioScores = {
    clinical_fidelity_index: clamp(cfi),
    simulation_realism: clamp(realism),
    diagnostic_accuracy: clamp(diagnostic),
    educational_value: clamp(educational),
    language_fidelity: clamp(language),
    overall: 0,
  };
  scores.overall = clamp(
    avg([
      scores.clinical_fidelity_index,
      scores.simulation_realism,
      scores.diagnostic_accuracy,
      scores.educational_value,
      scores.language_fidelity,
    ]),
  );

  return {
    slug: disorder.slug,
    name: disorder.name,
    dsm5_code: disorder.dsm5_code,
    icd11_code: disorder.icd11_code,
    scores,
    findings,
    verdict: verdictFromScore(scores.overall, findings),
    checks,
  };
}

export function certifyTemplate(
  template: ClinicalScenarioTemplate,
  disordersBySlug: Map<string, DisorderRow>,
): TemplateCertification {
  const findings: Finding[] = [];
  const primarySlug = template.primary_diagnosis_slug ?? "";
  const primary = disordersBySlug.get(primarySlug);

  if (!primarySlug || !primary) {
    findings.push({
      severity: "Critical",
      code: "unknown_primary",
      message: `Unknown primary diagnosis ${template.primary_diagnosis_slug}`,
    });
  }
  if (
    template.slug === "ptsd-risk-assessment-en" &&
    template.default_persona_slug === "maya-chen"
  ) {
    findings.push({
      severity: "Critical",
      code: "ptsd_maya_bind",
      message: "PTSD template must not bind MDD persona maya-chen",
    });
  }
  if (
    template.language.startsWith("ar") &&
    template.culture &&
    /north_american/i.test(template.culture)
  ) {
    findings.push({
      severity: "High",
      code: "ar_culture_mismatch",
      message: "Arabic template with North American culture tag",
    });
  }
  if ((template.learning_objectives ?? []).length < 2) {
    findings.push({
      severity: "High",
      code: "thin_objectives",
      message: "Fewer than 2 learning objectives",
    });
  }
  if ((template.clinical_competencies ?? []).length < 1) {
    findings.push({
      severity: "High",
      code: "no_competencies",
      message: "No clinical competencies",
    });
  }
  if (!template.grading_rubric?.pass_threshold) {
    findings.push({
      severity: "Medium",
      code: "no_pass_threshold",
      message: "Missing pass threshold",
    });
  }

  let diagnostic = primary ? 92 : 40;
  let cfi = primary ? 88 : 40;
  let realism = 86;
  let educational =
    70 +
    Math.min(20, (template.learning_objectives?.length ?? 0) * 4) +
    Math.min(10, (template.clinical_competencies?.length ?? 0) * 3);
  let language = template.language.startsWith("ar") ? 90 : 92;
  if (template.culture?.includes("levantine")) language += 3;

  if (findings.some((f) => f.severity === "Critical")) {
    cfi -= 35;
    diagnostic -= 35;
    realism -= 25;
  }
  for (const f of findings.filter((x) => x.severity === "High")) {
    void f;
    cfi -= 8;
    educational -= 5;
  }

  const scores: ScenarioScores = {
    clinical_fidelity_index: clamp(cfi),
    simulation_realism: clamp(realism),
    diagnostic_accuracy: clamp(diagnostic),
    educational_value: clamp(educational),
    language_fidelity: clamp(language),
    overall: 0,
  };
  scores.overall = clamp(
    avg([
      scores.clinical_fidelity_index,
      scores.simulation_realism,
      scores.diagnostic_accuracy,
      scores.educational_value,
      scores.language_fidelity,
    ]),
  );

  return {
    slug: template.slug,
    name: template.name,
    language: template.language,
    primary_diagnosis_slug: primarySlug,
    scores,
    findings,
    verdict: verdictFromScore(scores.overall, findings),
  };
}

export function certifyPreset(
  preset: InstructorPreset,
  templateSlugs: Set<string>,
): PresetCertification {
  const findings: Finding[] = [];
  if (
    preset.scenario_template_slug &&
    !templateSlugs.has(preset.scenario_template_slug)
  ) {
    findings.push({
      severity: "High",
      code: "missing_template_ref",
      message: `References missing template ${preset.scenario_template_slug}`,
    });
  }
  if ((preset.required_competencies ?? []).length < 1) {
    findings.push({
      severity: "High",
      code: "no_required_competencies",
      message: "No required competencies",
    });
  }
  if (!preset.primary_objective) {
    findings.push({
      severity: "Critical",
      code: "no_primary_objective",
      message: "Missing primary objective",
    });
  }

  let educational = 85;
  let cfi = 88;
  let realism = 86;
  let diagnostic = 90;
  let language = preset.language.startsWith("ar") ? 90 : 91;
  if (findings.some((f) => f.severity === "High")) {
    educational -= 10;
    cfi -= 8;
  }
  if (findings.some((f) => f.severity === "Critical")) {
    educational -= 30;
    cfi -= 30;
  }

  const scores: ScenarioScores = {
    clinical_fidelity_index: clamp(cfi),
    simulation_realism: clamp(realism),
    diagnostic_accuracy: clamp(diagnostic),
    educational_value: clamp(educational),
    language_fidelity: clamp(language),
    overall: 0,
  };
  scores.overall = clamp(
    avg([
      scores.clinical_fidelity_index,
      scores.simulation_realism,
      scores.diagnostic_accuracy,
      scores.educational_value,
      scores.language_fidelity,
    ]),
  );

  return {
    slug: preset.slug,
    name: preset.name,
    language: preset.language ?? "en-US",
    scores,
    findings,
    verdict: verdictFromScore(scores.overall, findings),
  };
}

export function aggregateBoardVerdict(
  disorders: DisorderCertification[],
  templates: TemplateCertification[],
  presets: PresetCertification[],
): {
  overall_score: number;
  verdict: ScenarioVerdict;
  failed: string[];
  with_recs: string[];
  certified: string[];
} {
  const all = [...disorders, ...templates, ...presets];
  const overall_score = clamp(avg(all.map((x) => x.scores.overall)));
  const failed = all.filter((x) => x.verdict === "SCENARIO_FAILED").map((x) => x.slug);
  const with_recs = all
    .filter((x) => x.verdict === "SCENARIO_CERTIFIED_WITH_RECOMMENDATIONS")
    .map((x) => x.slug);
  const certified = all
    .filter((x) => x.verdict === "SCENARIO_CERTIFIED")
    .map((x) => x.slug);

  let verdict: ScenarioVerdict = "SCENARIO_CERTIFIED";
  if (failed.length > 0 || overall_score < 70) verdict = "SCENARIO_FAILED";
  else if (with_recs.length > 0 || overall_score < 90)
    verdict = "SCENARIO_CERTIFIED_WITH_RECOMMENDATIONS";

  return { overall_score, verdict, failed, with_recs, certified };
}
