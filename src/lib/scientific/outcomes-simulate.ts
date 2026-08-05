/**
 * Educational outcome simulation across learner archetypes (≥100 sessions).
 * Uses ACE ingest + adaptive path — deterministic offline evidence for Mission 19.
 */

import { createRng } from "@/lib/case-engine/generator";
import {
  createLearnerProfile,
  ingestSessionAssessment,
} from "@/lib/ace/engine";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import type { CompetencyId, LearnerProfile } from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";
import { summarizePsychometrics } from "@/lib/scientific/psychometrics";

export type LearnerArchetype =
  | "medical_student"
  | "psychology_student"
  | "gp"
  | "psychologist"
  | "psychiatry_resident"
  | "consultant_psychiatrist";

const ARCHETYPES: Array<{
  id: LearnerArchetype;
  startOverall: number;
  learningRate: number;
  noise: number;
  weak: CompetencyId;
}> = [
  {
    id: "medical_student",
    startOverall: 48,
    learningRate: 4.5,
    noise: 6,
    weak: "diagnostic_interview",
  },
  {
    id: "psychology_student",
    startOverall: 52,
    learningRate: 4.2,
    noise: 5,
    weak: "risk_assessment",
  },
  {
    id: "gp",
    startOverall: 58,
    learningRate: 3.2,
    noise: 5,
    weak: "suicide_assessment",
  },
  {
    id: "psychologist",
    startOverall: 62,
    learningRate: 3.0,
    noise: 4,
    weak: "medication_management",
  },
  {
    id: "psychiatry_resident",
    startOverall: 68,
    learningRate: 2.5,
    noise: 4,
    weak: "cbt_skills",
  },
  {
    id: "consultant_psychiatrist",
    startOverall: 78,
    learningRate: 1.2,
    noise: 3,
    weak: "documentation",
  },
];

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function itemsFromOverall(overall: number, weak: CompetencyId): ScoreEntry[] {
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
  const weakPenalty = 12;
  const mk = (id: string, pct: number): ScoreEntry => ({
    id,
    label: id,
    score: to5(pct),
    max: 5,
    weight: 20,
    feedback: "sim",
  });
  const safety =
    weak === "suicide_assessment" || weak === "risk_assessment"
      ? overall - weakPenalty
      : overall;
  const assessment =
    weak === "diagnostic_interview" ? overall - weakPenalty : overall;
  const interventions =
    weak === "cbt_skills" ? overall - weakPenalty : overall;
  return [
    mk("alliance", overall),
    mk("assessment", assessment),
    mk("interventions", interventions),
    mk("safety", safety),
    mk("structure", overall - 2),
  ];
}

export type OutcomeSimulationResult = {
  sessions: number;
  learners: number;
  by_archetype: Record<
    string,
    {
      n: number;
      mean_first: number;
      mean_last: number;
      improved: boolean;
      delta: number;
    }
  >;
  overall_improved_fraction: number;
  adaptive_decisions: number;
  psychometrics: ReturnType<typeof summarizePsychometrics>;
  en_scores: number[];
  ar_scores: number[];
};

/**
 * Run ≥100 simulated learning sessions across six learner archetypes.
 */
export function simulateEducationalOutcomes(
  minSessions = 100,
): OutcomeSimulationResult {
  const rng = createRng("m19-scientific-outcomes");
  const by: OutcomeSimulationResult["by_archetype"] = {};
  const overalls: number[] = [];
  const itemMatrix: number[][] = [];
  const retest: number[] = [];
  const en_scores: number[] = [];
  const ar_scores: number[] = [];
  let sessions = 0;
  let adaptive_decisions = 0;
  let improvedCount = 0;

  const learnersPer = Math.max(3, Math.ceil(minSessions / (ARCHETYPES.length * 6)));
  let totalLearners = 0;

  for (const arch of ARCHETYPES) {
    const firsts: number[] = [];
    const lasts: number[] = [];
    for (let L = 0; L < learnersPer; L++) {
      totalLearners += 1;
      let profile: LearnerProfile = createLearnerProfile({
        user_id: `sim-${arch.id}-${L}`,
        profession: arch.id === "medical_student" ? "medical_student" : "psychiatry_resident",
        training_level:
          arch.id === "consultant_psychiatrist"
            ? "fellowship"
            : arch.id.includes("student")
              ? "undergraduate"
              : "residency",
      });
      // Seed weakness
      profile = {
        ...profile,
        competencies: profile.competencies.map((c) =>
          c.competency_id === arch.weak
            ? { ...c, score: Math.max(20, arch.startOverall - 15), samples: 1 }
            : c,
        ),
      };

      let first = 0;
      let last = 0;
      for (let s = 0; s < 6; s++) {
        const progress = arch.startOverall + s * arch.learningRate;
        const noise = (rng() - 0.5) * 2 * arch.noise;
        const overall = clamp(progress + noise);
        if (s === 0) first = overall;
        if (s === 5) last = overall;
        const items = itemsFromOverall(overall, arch.weak);
        const locale = s % 2 === 0 ? "en-US" : "ar-JO";
        if (locale.startsWith("en")) en_scores.push(overall);
        else ar_scores.push(overall);

        const result = ingestSessionAssessment(profile, {
          overall,
          items,
          sessionId: `sess-${arch.id}-${L}-${s}`,
          diagnosisSlug: "mdd-recurrent-moderate",
          // Scientific fix: do not invent diagnosis correctness from overall
          correctDiagnosis: undefined,
          durationSec: 1200,
          timeLimitSec: 2400,
        });
        profile = result.profile;
        const next = generateAdaptiveCase(profile, {
          seed: `adapt-${arch.id}-${L}-${s}`,
        });
        if (next) adaptive_decisions += 1;

        overalls.push(overall);
        itemMatrix.push(items.map((i) => (i.score / i.max) * 100));
        // synthetic retest = overall + small noise for stability estimate
        retest.push(clamp(overall + (rng() - 0.5) * 4));
        sessions += 1;
      }
      firsts.push(first);
      lasts.push(last);
      if (last > first + 1) improvedCount += 1;
    }
    const mean = (xs: number[]) =>
      xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    by[arch.id] = {
      n: learnersPer,
      mean_first: Math.round(mean(firsts) * 10) / 10,
      mean_last: Math.round(mean(lasts) * 10) / 10,
      improved: mean(lasts) > mean(firsts),
      delta: Math.round((mean(lasts) - mean(firsts)) * 10) / 10,
    };
  }

  return {
    sessions,
    learners: totalLearners,
    by_archetype: by,
    overall_improved_fraction:
      Math.round((improvedCount / Math.max(1, totalLearners)) * 1000) / 1000,
    adaptive_decisions,
    psychometrics: summarizePsychometrics({
      overalls,
      itemMatrix,
      retestOveralls: retest,
    }),
    en_scores,
    ar_scores,
  };
}
