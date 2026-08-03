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

/** Content identity ignoring salt suffixes and learner id. */
export function contentSignature(
  disorder: string,
  difficulty: string,
  focus: string[],
  adaptations: string[],
  siStyle: string | undefined,
): string {
  const cleaned = adaptations
    .filter((a) => !a.startsWith("cge_") && !a.startsWith("explain:"))
    .slice()
    .sort();
  return [
    disorder,
    difficulty,
    focus.slice().sort().join(","),
    cleaned.join(","),
    siStyle ?? "",
  ].join("|");
}

export function contentSignatureFromFingerprint(fp: string): string {
  const base = fp.split("#")[0] ?? fp;
  const parts = base.split("|");
  // learner|disorder|difficulty|focus|adaptations|siStyle|step
  if (parts.length < 6) return base;
  return [parts[1], parts[2], parts[3], parts[4], parts[5]].join("|");
}

/**
 * Suicide / risk ladder step from exposure count — no modulo wrap
 * (wrapping caused Passive-SI repetition traps).
 */
export function remediationStepIndex(
  samples: number,
  ladderLength: number,
  explicit?: number,
): number {
  const raw = explicit ?? samples;
  return Math.min(ladderLength - 1, Math.max(0, Math.floor(raw)));
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
      confidence: 40,
      explainability: {
        active_rules: [],
        decision:
          "Adaptive mode disabled; returning manual curriculum placeholder.",
      },
    };
  }

  const rng = createRng(
    opts?.seed ?? `${profile.id}:${profile.completed_case_count}`,
  );
  const prior = new Set(opts?.priorFingerprints ?? []);
  const priorContent = new Set(
    [...prior].map((f) => contentSignatureFromFingerprint(f)),
  );
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

  let focus: CompetencyId[] = primary?.adaptation.focus?.length
    ? [...primary.adaptation.focus]
    : weakest
      ? [weakest.competency_id]
      : ["diagnostic_interview"];

  // Instructor-locked objectives force curriculum focus (High H2).
  if (profile.locked_objectives.length) {
    const locked = profile.locked_objectives.filter((o): o is CompetencyId =>
      profile.competencies.some((c) => c.competency_id === o),
    );
    if (locked.length) {
      focus = [...new Set([...locked, ...focus])];
    }
  }

  // Locked diagnoses from instructor controls
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
  let ladderStep = opts?.stepIndex ?? profile.completed_case_count;

  if (focus.includes("suicide_assessment")) {
    const samples =
      profile.competencies.find((c) => c.competency_id === "suicide_assessment")
        ?.samples ?? 0;
    // Prefer explicit step, else exposure samples — never modulo-wrap.
    let step = remediationStepIndex(
      samples,
      SUICIDE_CURRICULUM_STEPS.length,
      opts?.stepIndex,
    );
    // Skip ladder stages whose content already appeared (anti-trap).
    for (let probe = step; probe < SUICIDE_CURRICULUM_STEPS.length; probe++) {
      const staged = SUICIDE_CURRICULUM_STEPS[probe]!;
      const sig = contentSignature(
        staged.diagnosis,
        staged.difficulty,
        focus,
        [...adaptations, `si_style:${staged.si_style}`],
        staged.si_style,
      );
      if (!priorContent.has(sig) || probe === SUICIDE_CURRICULUM_STEPS.length - 1) {
        step = probe;
        break;
      }
    }
    const staged = SUICIDE_CURRICULUM_STEPS[step]!;
    // Locked diagnoses still win over suicide staging when set.
    if (!profile.locked_diagnoses.length) {
      diagnosisPool = [staged.diagnosis];
      // After ladder ceiling, rotate secondary diagnoses to avoid content traps.
      if (
        step >= SUICIDE_CURRICULUM_STEPS.length - 1 &&
        profile.completed_case_count >= SUICIDE_CURRICULUM_STEPS.length
      ) {
        const rotate = [
          staged.diagnosis,
          "bpd",
          "ptsd",
          "mdd-recurrent-moderate",
          "alcohol-use-disorder",
        ];
        diagnosisPool = rotate.filter((d) => findDisorderBySlug(d));
        const cycle = profile.completed_case_count % 3;
        if (cycle === 1) adaptations.push("comorbidity");
        if (cycle === 2) adaptations.push("time_pressure");
        adaptations.push(`exposure_cycle:${cycle}`);
      }
    }
    siStyle = staged.si_style;
    difficulty = staged.difficulty;
    adaptations.push(`si_style:${staged.si_style}`);
    ladderStep = step;
  }

  if (primary?.adaptation.increase) {
    adaptations.push(...primary.adaptation.increase);
  }
  if (primary?.adaptation.reduce) {
    adaptations.push(...primary.adaptation.reduce.map((r) => `reduce:${r}`));
  }

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

  // Pick non-repeating diagnosis by content signature
  let disorderSlug = diagnosisPool[0]!;
  const shuffled = [...diagnosisPool].sort(() => rng() - 0.5);
  for (const d of shuffled) {
    const sig = contentSignature(d, difficulty, focus, adaptations, siStyle);
    if (!priorContent.has(sig) && findDisorderBySlug(d)) {
      disorderSlug = d;
      break;
    }
    if (findDisorderBySlug(d)) disorderSlug = d;
  }
  if (!findDisorderBySlug(disorderSlug)) {
    disorderSlug = "mdd-recurrent-moderate";
  }

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
    ladderStep,
  );

  let uniqueFp = fp;
  let salt = 0;
  while (prior.has(uniqueFp) && salt < 50) {
    salt += 1;
    uniqueFp = `${fp}#${salt}`;
  }

  const focusScore = scoreOf(profile.competencies, focus[0]!);
  const decisionConfidence = Math.max(
    35,
    Math.min(
      95,
      Math.round(
        (primary ? 70 : 55) +
          Math.min(20, (profile.competencies.find((c) => c.competency_id === focus[0])?.samples ?? 0) * 3) -
          Math.max(0, profile.min_competency_threshold - focusScore) * 0.4,
      ),
    ),
  );

  const decision = primary
    ? `Activated rule "${primary.slug}" (priority ${primary.priority}) because ${primary.trigger_competency_id} ${primary.trigger_operator} ${primary.trigger_threshold} with assessed samples. Focus=${focus.join(", ")}; case=${disorderSlug}@${difficulty}${siStyle ? `; SI=${siStyle}` : ""}.`
    : `No remediation rule matched; selected weakest assessed competency ${focus[0]} → ${disorderSlug}@${difficulty}.`;

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
    confidence: decisionConfidence,
    explainability: {
      active_rules: active.map((r) => r.slug),
      decision,
      ladder_step: focus.includes("suicide_assessment") ? ladderStep : undefined,
      content_signature: contentSignature(
        disorderSlug,
        difficulty,
        focus,
        adaptations,
        siStyle,
      ),
    },
  };
}

/** Detect infinite remediation loops by content identity (not salt). */
export function detectRepetitionLoop(
  fingerprints: string[],
  window = 8,
): boolean {
  if (fingerprints.length < window) return false;
  const recent = fingerprints
    .slice(-window)
    .map((f) => contentSignatureFromFingerprint(f));
  const unique = new Set(recent);
  return unique.size <= 2;
}
