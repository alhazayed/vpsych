import type { CaseDifficulty } from "@/lib/case-engine/types";
import { createRng } from "@/lib/case-engine/generator";
import { findDisorderBySlug } from "@/lib/case-engine/catalog";
import {
  BUILTIN_ADAPTIVE_RULES,
  scoreOf,
  SUICIDE_CURRICULUM_STEPS,
} from "./catalog";
import type {
  AdaptiveCaseRequest,
  AdaptiveRule,
  CompetencyId,
  LearnerProfile,
} from "./types";

const DIFFICULTY_ORDER: CaseDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

function clampDifficulty(
  base: CaseDifficulty,
  delta: number,
  max: CaseDifficulty,
): CaseDifficulty {
  const maxIdx = DIFFICULTY_ORDER.indexOf(max);
  const idx = Math.max(
    0,
    Math.min(maxIdx, DIFFICULTY_ORDER.indexOf(base) + delta),
  );
  return DIFFICULTY_ORDER[idx]!;
}

function ruleMatches(rule: AdaptiveRule, profile: LearnerProfile): boolean {
  if (!rule.enabled) return false;
  const row = profile.competencies.find(
    (c) => c.competency_id === rule.trigger_competency_id,
  );
  // Do not remediate unassessed competencies (baseline noise).
  // Acceleration rules may fire on assessed high scores only.
  const samples = row?.samples ?? 0;
  if (samples < 1) return false;
  const score = row?.score ?? 50;
  const t = rule.trigger_threshold;
  switch (rule.trigger_operator) {
    case "lt":
      return score < t;
    case "lte":
      return score <= t;
    case "gt":
      return score > t;
    case "gte":
      return score >= t;
    case "between":
      return score >= t && score <= (rule.trigger_threshold_high ?? t);
    default:
      return false;
  }
}

function rulePreconditionsOk(
  rule: AdaptiveRule,
  profile: LearnerProfile,
): boolean {
  const a = rule.adaptation;
  if (a.require_velocity_min != null) {
    if (profile.learning_velocity < a.require_velocity_min) return false;
  }
  for (const req of a.require_high ?? []) {
    if (scoreOf(profile.competencies, req.competency) < req.min) return false;
  }
  return true;
}

export function selectActiveRules(
  profile: LearnerProfile,
  rules: AdaptiveRule[] = BUILTIN_ADAPTIVE_RULES,
): AdaptiveRule[] {
  return rules
    .filter((r) => ruleMatches(r, profile) && rulePreconditionsOk(r, profile))
    .sort((a, b) => b.priority - a.priority);
}

function fingerprintFor(
  learnerId: string,
  disorder: string,
  difficulty: string,
  focus: string[],
  adaptations: string[],
  siStyle: string | undefined,
  step: number,
): string {
  return [
    learnerId,
    disorder,
    difficulty,
    focus.slice().sort().join(","),
    adaptations.slice().sort().join(","),
    siStyle ?? "",
    String(step),
  ].join("|");
}

/**
 * Generate the next adaptive case request for a learner.
 * Targets competency deficits — does not blindly raise difficulty.
 */
export function generateAdaptiveCase(
  profile: LearnerProfile,
  opts?: {
    seed?: string | number;
    priorFingerprints?: string[];
    rules?: AdaptiveRule[];
    stepIndex?: number;
  },
): AdaptiveCaseRequest {
  if (!profile.adaptive_mode && profile.curriculum_mode === "manual") {
    return {
      difficulty: "intermediate",
      focusCompetencies: profile.required_competencies.slice(0, 2),
      adaptations: [],
      rationale: "Adaptive mode off — manual curriculum placeholder",
      fingerprint: fingerprintFor(
        profile.id,
        "manual",
        "intermediate",
        profile.required_competencies,
        [],
        undefined,
        opts?.stepIndex ?? 0,
      ),
    };
  }

  const rng = createRng(
    opts?.seed ?? `${profile.id}:${profile.completed_case_count}`,
  );
  const prior = new Set(opts?.priorFingerprints ?? []);
  const active = selectActiveRules(profile, opts?.rules);
  const primary = active[0];

  // Weakest *assessed* competency drives focus when no rule fires
  const assessed = profile.competencies.filter((c) => c.samples > 0);
  const pool = assessed.length
    ? assessed
    : profile.competencies.filter((c) =>
        profile.required_competencies.length
          ? profile.required_competencies.includes(c.competency_id)
          : c.competency_id === "diagnostic_interview",
      );
  const weakest = [...pool].sort((a, b) => a.score - b.score)[0];

  const focus: CompetencyId[] = primary?.adaptation.focus?.length
    ? primary.adaptation.focus
    : weakest
      ? [weakest.competency_id]
      : ["diagnostic_interview"];

  // Locked objectives / diagnoses from instructor controls
  let diagnosisPool =
    primary?.adaptation.diagnosis_pool ??
    ["mdd-recurrent-moderate", "gad-with-panic", "ptsd"];
  if (profile.locked_diagnoses.length) {
    diagnosisPool = profile.locked_diagnoses;
  }

  // Suicide remediation curriculum progression
  let siStyle: string | undefined;
  let difficulty: CaseDifficulty = "intermediate";
  const adaptations: string[] = [
    ...(primary?.adaptation.adaptations ?? []),
  ];

  if (focus.includes("suicide_assessment")) {
    const rawStep =
      opts?.stepIndex ??
      (profile.competencies.find((c) => c.competency_id === "suicide_assessment")
        ?.samples ?? 0);
    const step = Math.min(
      SUICIDE_CURRICULUM_STEPS.length - 1,
      Math.max(0, rawStep % SUICIDE_CURRICULUM_STEPS.length),
    );
    const staged = SUICIDE_CURRICULUM_STEPS[step]!;
    diagnosisPool = [staged.diagnosis];
    siStyle = staged.si_style;
    difficulty = staged.difficulty;
    adaptations.push(`si_style:${staged.si_style}`);
  }

  if (primary?.adaptation.increase) {
    adaptations.push(...primary.adaptation.increase);
  }
  if (primary?.adaptation.reduce) {
    adaptations.push(...primary.adaptation.reduce.map((r) => `reduce:${r}`));
  }

  // Hold unrelated therapy complexity when remediating differential with strong CBT
  if (primary?.adaptation.hold_therapy_complexity) {
    adaptations.push("hold_cbt_complexity");
  }
  if (primary?.adaptation.reduce_unrelated_complexity) {
    adaptations.push("reduce_unrelated_complexity");
  }

  const delta = primary?.adaptation.difficulty_delta ?? 0;
  if (!focus.includes("suicide_assessment")) {
    difficulty = clampDifficulty("intermediate", delta, profile.max_difficulty);
  } else {
    difficulty = clampDifficulty(difficulty, 0, profile.max_difficulty);
  }

  // Pick non-repeating diagnosis
  let disorderSlug = diagnosisPool[0]!;
  const shuffled = [...diagnosisPool].sort(() => rng() - 0.5);
  for (const d of shuffled) {
    const fp = fingerprintFor(
      profile.id,
      d,
      difficulty,
      focus,
      adaptations,
      siStyle,
      opts?.stepIndex ?? profile.completed_case_count,
    );
    if (!prior.has(fp) && findDisorderBySlug(d)) {
      disorderSlug = d;
      break;
    }
  }
  if (!findDisorderBySlug(disorderSlug)) {
    disorderSlug = "mdd-recurrent-moderate";
  }

  // Comorbidity only when adaptation asks — not blanket difficulty hike
  const comorbiditySlugs: string[] = [];
  if (
    adaptations.includes("comorbidity") ||
    adaptations.includes("mixed_presentation")
  ) {
    const options = ["gad-with-panic", "alcohol-use-disorder"].filter(
      (s) => s !== disorderSlug,
    );
    if (options.length) {
      comorbiditySlugs.push(options[Math.floor(rng() * options.length)]!);
    }
  }

  const presetSlug =
    primary?.adaptation.preset_slugs?.[0] ??
    (focus.includes("suicide_assessment")
      ? "suicide-risk-resident-en"
      : focus.includes("cbt_skills")
        ? "cbt-skills-gp-en"
        : undefined);

  let timeLimitMinutes = 40;
  if (adaptations.includes("time_pressure")) timeLimitMinutes = 20;
  if (adaptations.some((a) => a === "reduce:time_pressure")) {
    timeLimitMinutes = 45;
  }

  const fp = fingerprintFor(
    profile.id,
    disorderSlug,
    difficulty,
    focus,
    adaptations,
    siStyle,
    opts?.stepIndex ?? profile.completed_case_count,
  );

  // Ensure uniqueness under repetition pressure
  let uniqueFp = fp;
  let salt = 0;
  while (prior.has(uniqueFp) && salt < 50) {
    salt += 1;
    uniqueFp = `${fp}#${salt}`;
  }

  return {
    presetSlug,
    disorderSlug,
    comorbiditySlugs,
    difficulty,
    therapyModality: profile.preferred_therapy_models[0] ?? "cbt",
    focusCompetencies: focus,
    adaptations,
    siStyle,
    timeLimitMinutes,
    allowHints: primary?.adaptation.allow_hints,
    feedbackMode: primary?.adaptation.feedback_mode,
    rationale: primary
      ? `Rule ${primary.slug}: focus ${focus.join(", ")} via ${disorderSlug} (${difficulty})`
      : `Weakest competency ${focus[0]} → ${disorderSlug}`,
    fingerprint: uniqueFp,
  };
}

/** Detect infinite remediation loops (same fingerprint family repeated). */
export function detectRepetitionLoop(
  fingerprints: string[],
  window = 8,
): boolean {
  if (fingerprints.length < window) return false;
  const recent = fingerprints.slice(-window).map((f) => f.split("#")[0]);
  const unique = new Set(recent);
  return unique.size <= 2;
}
