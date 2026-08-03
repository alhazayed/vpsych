/**
 * Offline AVI corpus — repeated assessments + scoring stability.
 */

import { createRng } from "@/lib/case-engine/generator";
import { BUILTIN_TEMPLATES } from "@/lib/scenario-templates/catalog";
import {
  assessFairnessControls,
  localeScoreParity,
} from "@/lib/scientific/fairness";
import {
  pearson,
  summarizePsychometrics,
} from "@/lib/scientific/psychometrics";
import type { ScoreEntry } from "@/lib/types";
import { computeAssessmentValidityIndex } from "@/lib/avi/engine";
import { aviInputFromAssessment } from "@/lib/avi/from-assessment";
import type { StoredAviRecord } from "@/lib/avi/aggregate";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function itemsFromOverall(overall: number, noise = 0): ScoreEntry[] {
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round(((pct + noise) / 100) * 5)));
  const mk = (id: string, pct: number, feedback: string): ScoreEntry => ({
    id,
    label: id,
    score: to5(pct),
    max: 5,
    weight: 20,
    feedback,
  });
  return [
    mk(
      "alliance",
      overall,
      "Alliance: collaborative stance present; deepen reflective listening.",
    ),
    mk(
      "assessment",
      overall - 2,
      "Assessment: elicit onset, course, and diagnostic criteria systematically.",
    ),
    mk(
      "interventions",
      overall - 4,
      "Interventions: match technique to formulation and session goals.",
    ),
    mk(
      "safety",
      overall - 6,
      "Safety: complete structured risk inquiry with protective factors.",
    ),
    mk(
      "structure",
      overall,
      "Structure: set agenda and close with collaborative summary.",
    ),
  ];
}

const CASES: Array<{
  id: string;
  base: number;
  difficulty: string;
  locale: string;
  mode: "llm_examiner" | "heuristic_fallback" | "simulation";
}> = [
  {
    id: "mdd-en-llm",
    base: 72,
    difficulty: "intermediate",
    locale: "en-US",
    mode: "llm_examiner",
  },
  {
    id: "mdd-ar-llm",
    base: 70,
    difficulty: "intermediate",
    locale: "ar-JO",
    mode: "llm_examiner",
  },
  {
    id: "gad-en-llm",
    base: 68,
    difficulty: "beginner",
    locale: "en-US",
    mode: "llm_examiner",
  },
  {
    id: "gad-ar-sim",
    base: 66,
    difficulty: "beginner",
    locale: "ar-JO",
    mode: "simulation",
  },
  {
    id: "ptsd-en-adv",
    base: 78,
    difficulty: "advanced",
    locale: "en-US",
    mode: "llm_examiner",
  },
  {
    id: "bpd-ar-adv",
    base: 74,
    difficulty: "advanced",
    locale: "ar-JO",
    mode: "simulation",
  },
  {
    id: "risk-en-heur",
    base: 55,
    difficulty: "intermediate",
    locale: "en-US",
    mode: "heuristic_fallback",
  },
  {
    id: "risk-ar-heur",
    base: 54,
    difficulty: "intermediate",
    locale: "ar-JO",
    mode: "heuristic_fallback",
  },
];

const REPEATS = 5;

/**
 * Build offline AVI corpus with repeated assessments per case.
 */
export function buildAviOfflineCorpus(): StoredAviRecord[] {
  const rng = createRng("avi-offline-corpus-v1");
  const loCount = Math.max(
    2,
    BUILTIN_TEMPLATES[0]?.learning_objectives?.length ?? 2,
  );

  const allOveralls: number[] = [];
  const itemMatrix: number[][] = [];
  const retest: number[] = [];
  const en_scores: number[] = [];
  const ar_scores: number[] = [];
  const byDifficulty = new Map<string, number[]>();

  type CasePack = {
    caseId: string;
    locale: string;
    mode: (typeof CASES)[number]["mode"];
    difficulty: string;
    repeats: number[];
    items: ScoreEntry[];
    narrative: string;
  };

  const packs: CasePack[] = [];

  for (const c of CASES) {
    const repeats: number[] = [];
    let lastItems: ScoreEntry[] = [];
    for (let r = 0; r < REPEATS; r++) {
      const noise = (rng() - 0.5) * 2 * (c.mode === "heuristic_fallback" ? 8 : 3);
      const overall = clamp(c.base + noise);
      repeats.push(overall);
      allOveralls.push(overall);
      const itemNoise = (rng() - 0.5) * 4;
      lastItems = itemsFromOverall(overall, itemNoise);
      itemMatrix.push(lastItems.map((i) => i.score));
      retest.push(clamp(overall + (rng() - 0.5) * 3));
      if (c.locale.startsWith("en")) en_scores.push(overall);
      else ar_scores.push(overall);
      const dArr = byDifficulty.get(c.difficulty) ?? [];
      dArr.push(overall);
      byDifficulty.set(c.difficulty, dArr);
    }
    packs.push({
      caseId: c.id,
      locale: c.locale,
      mode: c.mode,
      difficulty: c.difficulty,
      repeats,
      items: lastItems,
      narrative: [
        `Validity review for case ${c.id}.`,
        "Examiner narrative links interview findings to differentials, risk, and formulation.",
        `Difficulty=${c.difficulty}; mode=${c.mode}.`,
      ].join(" "),
    });
  }

  const psy = summarizePsychometrics({
    overalls: allOveralls,
    itemMatrix,
    retestOveralls: retest,
  });
  const parity = localeScoreParity(en_scores, ar_scores, "en-US", "ar-JO", 8);
  const fairness = assessFairnessControls({
    enArParityWithinTolerance: parity.within_tolerance,
    genderAllowedOnPackages: true,
    cultureDoesNotRewriteCodes: true,
    authoredNativePersonalities: true,
  });
  const fairnessPass = fairness.every(
    (f) => f.status === "pass" || f.status === "partial",
  );

  // Difficulty separation: advanced mean − beginner mean
  const beginner = byDifficulty.get("beginner") ?? [];
  const advanced = byDifficulty.get("advanced") ?? [];
  const difficultySeparation =
    beginner.length && advanced.length
      ? mean(advanced) - mean(beginner)
      : null;

  // Adjacent repeat correlation as reliability proxy across packs
  const a: number[] = [];
  const b: number[] = [];
  for (const p of packs) {
    for (let i = 1; i < p.repeats.length; i++) {
      a.push(p.repeats[i - 1]!);
      b.push(p.repeats[i]!);
    }
  }
  const adjacentR = pearson(a, b);

  return packs.map((p, idx) => {
    const avi = computeAssessmentValidityIndex(
      aviInputFromAssessment({
        items: p.items,
        narrative: p.narrative,
        excerpts: [
          "Therapist: What has been hardest this week?",
          "Patient: Sleep and low mood; I worry about work.",
        ],
        locale: p.locale,
        assessment_mode: p.mode,
        learning_objectives_count: loCount,
        has_scientific_provenance: p.mode !== "heuristic_fallback",
        has_external_criterion: false,
        cronbach_alpha: psy.cronbach_alpha,
        test_retest_r: adjacentR ?? psy.test_retest_r,
        discrimination_index: psy.discrimination_index,
        difficulty_separation: difficultySeparation,
        fairness_pass: fairnessPass,
        language_parity_within_tolerance: parity.within_tolerance,
        language_parity_abs_diff: parity.abs_diff,
        repeated_overalls: p.repeats,
        model_version: p.mode === "simulation" ? "simulation" : "corpus",
      }),
    );
    return {
      overall: avi.overall,
      variance: avi.variance,
      locale: p.locale,
      assessment_mode: p.mode,
      computed_at: new Date(Date.UTC(2026, 7, 1 + (idx % 7))).toISOString(),
      avi,
    };
  });
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
