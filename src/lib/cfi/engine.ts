/**
 * Clinical Fidelity Index engine — weighted scientific scoring (CFI v1.0).
 */

import { evidenceForSlug } from "@/lib/scientific/evidence";
import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
} from "@/lib/scientific/versions";
import type {
  CfiComputeInput,
  CfiConfidenceInterval,
  CfiDimensionScore,
  ClinicalFidelityIndex,
} from "@/lib/cfi/types";
import {
  CFI_VERSION,
  CFI_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  type CfiDimensionId,
  weightMap,
} from "@/lib/cfi/weights";

assertWeightMatrixValid();

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: CfiDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  clinical_reasoning: string,
  recommendations: string[] = [],
): CfiDimensionScore {
  const w = weightMap()[id];
  const s = clamp(score);
  return {
    id,
    score: s,
    weight: w,
    weighted_contribution: Math.round(s * w * 10) / 10,
    confidence: clamp(confidence),
    evidence,
    clinical_reasoning,
    recommendations,
  };
}

/** Disorder-aware impossible timeline heuristics. */
export function detectImpossibleTimeline(
  slug: string,
  onset: string | null | undefined,
): boolean {
  if (!onset) return false;
  const o = onset.toLowerCase();
  if (slug === "pdd" && /weeks?/.test(o) && !/year/.test(o)) return true;
  if (slug === "delirium" && /weeks?|months?/.test(o) && !/hour/.test(o))
    return true;
  if (slug === "bipolar-mania" && /years?/.test(o) && !/day/.test(o)) return true;
  return false;
}

function scoreDsm5(input: CfiComputeInput): CfiDimensionScore {
  const ev = evidenceForSlug(input.disorder_slug);
  const optional = input.dsm5_optional || ev?.dsm5_optional;
  if (optional && input.dsm5_code == null) {
    return dim(
      "dsm5_diagnostic_accuracy",
      92,
      90,
      ["dsm5_optional=true", "icd11_only_construct"],
      "ICD-11-only construct correctly omits DSM-5 code (e.g. CPTSD).",
    );
  }
  if (!input.dsm5_code) {
    return dim(
      "dsm5_diagnostic_accuracy",
      20,
      95,
      ["missing_dsm5_code"],
      "DSM-5-TR code missing without dsm5_optional flag.",
      ["Assign DSM-5-TR code or mark dsm5_optional with rationale"],
    );
  }
  if (ev && ev.dsm5_code && ev.dsm5_code !== input.dsm5_code) {
    return dim(
      "dsm5_diagnostic_accuracy",
      35,
      90,
      [`code=${input.dsm5_code}`, `evidence_lock=${ev.dsm5_code}`],
      "DSM-5 code diverges from evidence lock.",
      ["Align package code with evidence matrix"],
    );
  }
  const gradeBoost = ev?.evidence_grade === "A" ? 8 : ev?.evidence_grade === "B" ? 4 : 0;
  return dim(
    "dsm5_diagnostic_accuracy",
    85 + gradeBoost,
    ev ? 88 : 70,
    [`dsm5=${input.dsm5_code}`, ev ? `evidence_grade=${ev.evidence_grade}` : "no_evidence_lock"],
    "DSM-5-TR code present and consistent with evidence lock.",
    ev ? [] : ["Add evidence lock citation for this disorder"],
  );
}

function scoreIcd11(input: CfiComputeInput): CfiDimensionScore {
  const ev = evidenceForSlug(input.disorder_slug);
  if (!input.icd11_code) {
    return dim(
      "icd11_consistency",
      15,
      95,
      ["missing_icd11"],
      "ICD-11 code missing.",
      ["Assign ICD-11 code"],
    );
  }
  if (ev && ev.icd11_code && ev.icd11_code !== input.icd11_code) {
    return dim(
      "icd11_consistency",
      30,
      90,
      [`code=${input.icd11_code}`, `lock=${ev.icd11_code}`],
      "ICD-11 code diverges from evidence lock.",
      ["Align ICD-11 with evidence matrix"],
    );
  }
  // Known scientific pitfalls
  if (
    input.disorder_slug === "bipolar-mania" &&
    input.icd11_code === "6A60.1"
  ) {
    return dim(
      "icd11_consistency",
      25,
      95,
      ["6A60.1_without_psychosis"],
      "Psychotic mania package must not use ICD-11 6A60.1.",
      ["Use 6A60.2 for manic episode with psychotic symptoms"],
    );
  }
  if (input.disorder_slug === "bpd" && input.icd11_code === "6D10.0") {
    return dim(
      "icd11_consistency",
      40,
      90,
      ["6D10.0_alone"],
      "BPD teaching should include borderline pattern qualifier.",
      ["Use 6D10.1/6D11.5 (or documented severity + 6D11.5)"],
    );
  }
  return dim(
    "icd11_consistency",
    92,
    90,
    [`icd11=${input.icd11_code}`],
    "ICD-11 code present and consistent.",
  );
}

function scoreSymptoms(input: CfiComputeInput): CfiDimensionScore {
  const n = input.symptom_count;
  const domains = new Set(input.symptom_domains.filter(Boolean));
  let score = Math.min(95, 40 + n * 12 + domains.size * 5);
  const recs: string[] = [];
  if (n < 2) {
    score = Math.min(score, 45);
    recs.push("Expand symptom_profile to ≥2–3 core criteria");
  }
  if (n < 3 && ["schizophrenia", "bipolar-mania", "bpd", "complex-ptsd"].includes(input.disorder_slug)) {
    score = Math.min(score, 55);
    recs.push("Complex presentations require multi-domain symptoms");
  }
  return dim(
    "symptom_fidelity",
    score,
    n >= 2 ? 85 : 60,
    [`symptoms=${n}`, `domains=${[...domains].join(",") || "none"}`],
    "Symptom count and domain coverage relative to disorder complexity.",
    recs,
  );
}

function scoreSeverity(input: CfiComputeInput): CfiDimensionScore {
  if (!input.severity) {
    return dim(
      "severity_fidelity",
      50,
      50,
      ["severity_unset"],
      "Severity not set on snapshot.",
      ["Set severity_default on package and project to snapshot"],
    );
  }
  return dim(
    "severity_fidelity",
    88,
    80,
    [`severity=${input.severity}`],
    "Severity present on clinical core / snapshot.",
  );
}

function scoreTimeline(input: CfiComputeInput): CfiDimensionScore {
  if (!input.onset_duration) {
    return dim(
      "timeline_consistency",
      45,
      55,
      ["onset_missing"],
      "Onset/duration missing.",
      ["Set disorder-aware onset_duration"],
    );
  }
  if (input.impossible_timeline || detectImpossibleTimeline(input.disorder_slug, input.onset_duration)) {
    return dim(
      "timeline_consistency",
      15,
      90,
      [`onset=${input.onset_duration}`, "impossible_timeline"],
      "Onset/course is clinically impossible for this disorder.",
      ["Use disorder-aware timeline generator"],
    );
  }
  return dim(
    "timeline_consistency",
    90,
    82,
    [`onset=${input.onset_duration}`],
    "Timeline text present without known impossible-course markers.",
  );
}

function scoreComorbidity(input: CfiComputeInput): CfiDimensionScore {
  if (!input.comorbidities.length) {
    return dim(
      "comorbidity_consistency",
      85,
      75,
      ["no_comorbidities"],
      "No comorbidities — consistent by default.",
    );
  }
  const bad = input.comorbidities.filter((c) => c.compatible === false);
  if (bad.length) {
    return dim(
      "comorbidity_consistency",
      10,
      95,
      bad.map((b) => `incompatible:${b.slug}`),
      "Incompatible comorbidity present.",
      ["Reject impossible comorbidity pairs at generation"],
    );
  }
  return dim(
    "comorbidity_consistency",
    88,
    80,
    input.comorbidities.map((c) => c.slug),
    "Comorbidities listed without known incompatibility flags.",
  );
}

function scoreDifferentials(input: CfiComputeInput): CfiDimensionScore {
  const n = input.differentials_count;
  const r = input.rule_outs_count;
  let score = 40 + Math.min(40, n * 15) + Math.min(15, r * 10);
  const recs: string[] = [];
  if (n < 2) recs.push("Add ≥2 differentials to the disorder package");
  if (r < 1) recs.push("Add at least one explicit rule-out");
  return dim(
    "differential_consistency",
    score,
    n >= 2 ? 85 : 60,
    [`differentials=${n}`, `rule_outs=${r}`],
    "Differential and rule-out teaching completeness.",
    recs,
  );
}

function scoreMse(input: CfiComputeInput): CfiDimensionScore {
  let score = 40;
  const ev: string[] = [];
  if (input.has_clinical_teaching) {
    score += 15;
    ev.push("clinical_teaching");
  }
  if (input.has_insight_cue) {
    score += 15;
    ev.push("insight");
  }
  if (input.has_judgment_cue) {
    score += 15;
    ev.push("judgment");
  }
  if (input.has_speech_cue) {
    score += 15;
    ev.push("speech");
  }
  const recs: string[] = [];
  if (score < 70) recs.push("Project insight/judgment/speech MSE cues onto CaseInstance");
  return dim(
    "mse_realism",
    score,
    ev.length >= 3 ? 85 : 55,
    ev.length ? ev : ["mse_cues_absent"],
    "MSE realism from teaching/insight/judgment/speech cues.",
    recs,
  );
}

function scoreMeds(input: CfiComputeInput): CfiDimensionScore {
  if (input.has_medication_cue) {
    return dim(
      "medication_history",
      82,
      70,
      ["medication_cue_present"],
      "Medication history teaching cue present; no impossible regimen invented in package.",
    );
  }
  return dim(
    "medication_history",
    55,
    50,
    ["medication_cue_absent"],
    "No structured medication history cue — neutral-mid score (absence ≠ error).",
    ["Add medication_history teaching cue for psychotropic-relevant disorders"],
  );
}

function scoreRisk(input: CfiComputeInput): CfiDimensionScore {
  const r = input.risk;
  let score = 30;
  const ev: string[] = [];
  if (r.suicidal_ideation !== undefined) {
    score += 25;
    ev.push(`si=${r.suicidal_ideation}`);
  }
  if (r.self_harm !== undefined) {
    score += 15;
    ev.push(`self_harm=${r.self_harm}`);
  }
  if (r.harm_to_others !== undefined) {
    score += 15;
    ev.push(`harm_others=${r.harm_to_others}`);
  }
  if (r.escalation_rules) {
    score += 10;
    ev.push("escalation_rules");
  }
  const recs: string[] = [];
  if (r.suicidal_ideation === undefined) recs.push("Set suicidal_ideation default explicitly");
  if (r.self_harm === undefined || r.harm_to_others === undefined) {
    recs.push("Set self_harm and harm_to_others explicitly (do not rely on silent defaults)");
  }
  return dim(
    "risk_assessment",
    score,
    ev.length >= 3 ? 88 : 60,
    ev.length ? ev : ["risk_incomplete"],
    "Risk profile completeness and coherence.",
    recs,
  );
}

function scoreProtective(input: CfiComputeInput): CfiDimensionScore {
  // Protective factors often live in randomized_context / social cues
  if (input.has_culture_cue || input.teaching_points_count > 0) {
    return dim(
      "protective_factors",
      75,
      60,
      ["contextual_or_teaching_present"],
      "Contextual/teaching content available to support protective-factor inquiry.",
      ["Optionally encode explicit protective_factors on packages"],
    );
  }
  return dim(
    "protective_factors",
    50,
    45,
    ["protective_not_modeled"],
    "Protective factors not explicitly modeled.",
    ["Add protective_factors field to clinical packages"],
  );
}

function scoreSpeech(input: CfiComputeInput): CfiDimensionScore {
  if (input.has_speech_cue) {
    return dim(
      "speech_realism",
      88,
      80,
      ["speech_behavior_cue"],
      "Speech realism cue present on clinical teaching.",
    );
  }
  return dim(
    "speech_realism",
    55,
    50,
    ["speech_cue_absent"],
    "No disorder-specific speech cue.",
    ["Add speech_behavior_cue to clinical teaching"],
  );
}

function scoreBehavior(input: CfiComputeInput): CfiDimensionScore {
  if (input.has_speech_cue || input.symptom_count >= 2) {
    return dim(
      "behavior_realism",
      80,
      70,
      ["symptoms_or_speech_cue"],
      "Behavioural portrayal supported by symptoms/speech cues.",
    );
  }
  return dim(
    "behavior_realism",
    50,
    45,
    ["thin_behavior"],
    "Insufficient behavioural anchors.",
    ["Enrich symptom salience and speech/behaviour cues"],
  );
}

function scoreEmotion(input: CfiComputeInput): CfiDimensionScore {
  const moodDomains = input.symptom_domains.some((d) =>
    /mood|anxiety|trauma|affect/i.test(d),
  );
  if (moodDomains || input.severity) {
    return dim(
      "emotional_realism",
      82,
      72,
      [moodDomains ? "affective_domains" : "severity_set"],
      "Emotional realism supported by affective domains and/or severity.",
    );
  }
  return dim(
    "emotional_realism",
    55,
    50,
    ["emotion_under_specified"],
    "Affective domains under-specified.",
    ["Tag symptom domains for mood/affect"],
  );
}

function scoreCulture(input: CfiComputeInput): CfiDimensionScore {
  if (input.culture_rewrites_codes) {
    return dim(
      "cultural_realism",
      10,
      95,
      ["culture_rewrote_codes"],
      "Culture/locale must never rewrite DSM/ICD codes.",
      ["Enforce culture≠diagnosis invariant"],
    );
  }
  if (input.has_culture_cue) {
    return dim(
      "cultural_realism",
      88,
      80,
      ["culture_cue"],
      "Cultural/religion cue present; codes unchanged.",
    );
  }
  return dim(
    "cultural_realism",
    65,
    55,
    ["culture_cue_absent"],
    "No explicit culture cue; codes intact.",
    ["Add culture/religion teaching cue for bilingual cases"],
  );
}

function scoreLanguage(input: CfiComputeInput): CfiDimensionScore {
  const loc = input.locale || "";
  if (!loc) {
    return dim(
      "language_realism",
      40,
      70,
      ["locale_missing"],
      "Session locale missing.",
      ["Always set locale on CaseInstance"],
    );
  }
  const ok = /^(en|ar)/i.test(loc);
  return dim(
    "language_realism",
    ok ? 90 : 70,
    85,
    [`locale=${loc}`],
    "Locale set for bilingual educational platform.",
    ok ? [] : ["Prefer en-* or ar-* locales for certified corpora"],
  );
}

function scoreVoice(input: CfiComputeInput): CfiDimensionScore {
  if (input.has_voice_profile) {
    return dim(
      "voice_realism",
      90,
      75,
      ["voice_profile"],
      "Voice profile bound for spoken simulation.",
    );
  }
  return dim(
    "voice_realism",
    60,
    50,
    ["voice_not_bound"],
    "Text-mode acceptable; voice unbound reduces spoken fidelity only.",
    ["Bind locale-appropriate voice_profile for voice OSCE"],
  );
}

function scoreMemory(input: CfiComputeInput): CfiDimensionScore {
  if (input.memory_scope === "case_instance") {
    return dim(
      "memory_consistency",
      95,
      90,
      ["memory_scope=case_instance"],
      "Case-isolated memory prevents cross-session contamination.",
    );
  }
  return dim(
    "memory_consistency",
    55,
    60,
    [`memory_scope=${input.memory_scope ?? "unset"}`],
    "Memory scope not case-isolated.",
    ["Default memory_scope to case_instance"],
  );
}

function scoreDisclosure(input: CfiComputeInput): CfiDimensionScore {
  const n = input.disclosure_rules_count;
  if (n === 0) {
    return dim(
      "disclosure_consistency",
      40,
      70,
      ["no_disclosure_rules"],
      "No disclosure rules — risk of over-disclosure.",
      ["Add disclosure_rules for risk and core symptoms"],
    );
  }
  return dim(
    "disclosure_consistency",
    Math.min(95, 55 + n * 12),
    85,
    [`disclosure_rules=${n}`],
    "Disclosure rules present for graduated revelation.",
  );
}

function scorePrompt(input: CfiComputeInput): CfiDimensionScore {
  if (input.prompt_leakage_detected) {
    return dim(
      "prompt_consistency",
      5,
      95,
      ["prompt_leakage"],
      "Prompt leakage / identity leakage detected.",
      ["Sanitize ideal_approach and teaching text"],
    );
  }
  const hasVersion = Boolean(input.prompt_version);
  return dim(
    "prompt_consistency",
    hasVersion ? 92 : 70,
    hasVersion ? 88 : 60,
    [
      `prompt_version=${input.prompt_version ?? "unset"}`,
      `assessment_schema=${input.assessment_schema_version ?? "unset"}`,
    ],
    "Prompt version lock supports reproducible fidelity audits.",
    hasVersion ? [] : ["Stamp prompt_engine_version on scientific_meta"],
  );
}

const SCORERS: Record<CfiDimensionId, (i: CfiComputeInput) => CfiDimensionScore> = {
  dsm5_diagnostic_accuracy: scoreDsm5,
  icd11_consistency: scoreIcd11,
  symptom_fidelity: scoreSymptoms,
  severity_fidelity: scoreSeverity,
  timeline_consistency: scoreTimeline,
  comorbidity_consistency: scoreComorbidity,
  differential_consistency: scoreDifferentials,
  mse_realism: scoreMse,
  medication_history: scoreMeds,
  risk_assessment: scoreRisk,
  protective_factors: scoreProtective,
  speech_realism: scoreSpeech,
  behavior_realism: scoreBehavior,
  emotional_realism: scoreEmotion,
  cultural_realism: scoreCulture,
  language_realism: scoreLanguage,
  voice_realism: scoreVoice,
  memory_consistency: scoreMemory,
  disclosure_consistency: scoreDisclosure,
  prompt_consistency: scorePrompt,
};

/**
 * Approximate 95% CI from weighted dimension confidence (uncertainty).
 * lower/upper = overall ± 1.96 * weighted_rms( (100-confidence)/100 * 15 )
 */
export function confidenceInterval(
  overall: number,
  subscores: CfiDimensionScore[],
): CfiConfidenceInterval {
  const variance = subscores.reduce((acc, s) => {
    const uncertainty = ((100 - s.confidence) / 100) * 15;
    return acc + s.weight * uncertainty * uncertainty;
  }, 0);
  const se = Math.sqrt(variance);
  const margin = 1.96 * se;
  return {
    lower: clamp(overall - margin),
    upper: clamp(overall + margin),
    method: "weighted_dimension_uncertainty",
    level: 0.95,
  };
}

export function computeClinicalFidelityIndex(
  input: CfiComputeInput,
): ClinicalFidelityIndex {
  const subscores = CFI_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
  const overall = clamp(
    subscores.reduce((a, s) => a + s.score * s.weight, 0),
  );
  const ci = confidenceInterval(overall, subscores);
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 12);

  const low = subscores
    .filter((s) => s.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => `${s.id}=${s.score}`);

  const clinical_reasoning = [
    `CFI ${overall}/100 (v${CFI_VERSION}) for ${input.disorder_slug} @ ${input.locale}.`,
    `DSM-5 ${input.dsm5_code ?? "null"} / ICD-11 ${input.icd11_code ?? "null"}.`,
    low.length
      ? `Lowest dimensions: ${low.join(", ")}.`
      : "No dimension scored below 70.",
    `95% CI ≈ [${ci.lower}, ${ci.upper}] via weighted dimension uncertainty.`,
  ].join(" ");

  const evidenceDimensions: Record<string, string[]> = {};
  for (const s of subscores) evidenceDimensions[s.id] = s.evidence;

  return {
    overall,
    subscores,
    confidence_interval: ci,
    evidence: {
      disorder_slug: input.disorder_slug,
      locale: input.locale,
      severity: input.severity ?? null,
      dsm5_code: input.dsm5_code,
      icd11_code: input.icd11_code,
      dimensions: evidenceDimensions,
    },
    clinical_reasoning,
    recommendations,
    versions: {
      cfi_version: CFI_VERSION,
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      persona_version: input.persona_version ?? null,
      clinical_template_version: input.template_version ?? null,
      assessment_schema_version:
        input.assessment_schema_version ?? ASSESSMENT_SCHEMA_VERSION,
      disorder_package_version: input.disorder_package_version ?? null,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: CFI_VERSION,
  };
}
