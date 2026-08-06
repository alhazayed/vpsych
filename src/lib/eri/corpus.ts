/**
 * Offline ERI corpus from educational outcome simulation + ACE coach.
 */

import { createLearnerProfile, ingestSessionAssessment } from "@/lib/ace/engine";
import { generateSupervisorFeedback } from "@/lib/ace/coach";
import { createRng } from "@/lib/case-engine/generator";
import { BUILTIN_TEMPLATES } from "@/lib/scenario-templates/catalog";
import {
  assessFairnessControls,
  localeScoreParity,
} from "@/lib/scientific/fairness";
import { pearson, summarizePsychometrics } from "@/lib/scientific/psychometrics";
import type { ScoreEntry } from "@/lib/types";
import type { CompetencyId, LearnerProfile } from "@/lib/ace/types";
import { computeEducationalReliabilityIndex } from "@/lib/eri/engine";
import { eriInputFromAssessment } from "@/lib/eri/from-assessment";
import type { StoredEriRecord } from "@/lib/eri/aggregate";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function itemsFromOverall(overall: number, weak: CompetencyId): ScoreEntry[] {
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
  const weakPenalty = 12;
  const mk = (id: string, pct: number, feedback: string): ScoreEntry => ({
    id,
    label: id,
    score: to5(pct),
    max: 5,
    weight: 20,
    feedback,
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
    mk(
      "alliance",
      overall,
      "Alliance: warmth present; deepen reflective listening on affect cues.",
    ),
    mk(
      "assessment",
      assessment,
      "Assessment: cover onset, course, and key diagnostic criteria more systematically.",
    ),
    mk(
      "interventions",
      interventions,
      "Interventions: link technique choice to formulation and session goals.",
    ),
    mk(
      "safety",
      safety,
      "Safety: complete structured risk inquiry (ideation, plan, intent, protective factors).",
    ),
    mk(
      "structure",
      overall - 2,
      "Structure: set agenda early and close with collaborative summary/homework.",
    ),
  ];
}

const ARCHETYPES: Array<{
  id: string;
  startOverall: number;
  learningRate: number;
  noise: number;
  weak: CompetencyId;
  difficulty: string;
}> = [
  {
    id: "medical_student",
    startOverall: 48,
    learningRate: 4.5,
    noise: 6,
    weak: "diagnostic_interview",
    difficulty: "beginner",
  },
  {
    id: "psychology_student",
    startOverall: 52,
    learningRate: 4.2,
    noise: 5,
    weak: "risk_assessment",
    difficulty: "beginner",
  },
  {
    id: "gp",
    startOverall: 58,
    learningRate: 3.2,
    noise: 5,
    weak: "suicide_assessment",
    difficulty: "intermediate",
  },
  {
    id: "psychologist",
    startOverall: 62,
    learningRate: 3.0,
    noise: 4,
    weak: "medication_management",
    difficulty: "intermediate",
  },
  {
    id: "psychiatry_resident",
    startOverall: 68,
    learningRate: 2.5,
    noise: 4,
    weak: "cbt_skills",
    difficulty: "advanced",
  },
  {
    id: "consultant_psychiatrist",
    startOverall: 78,
    learningRate: 1.2,
    noise: 3,
    weak: "documentation",
    difficulty: "expert",
  },
];

type Pending = {
  overall: number;
  items: ScoreEntry[];
  narrative: string;
  coach: ReturnType<typeof generateSupervisorFeedback>;
  locale: string;
  difficulty: string;
  learner_id: string;
  session_id: string;
  computed_at: string;
  seed: number;
};

/**
 * Build a deterministic offline ERI corpus (6 archetypes × 6 sessions).
 */
export function buildEriOfflineCorpus(): StoredEriRecord[] {
  const rng = createRng("eri-offline-corpus-v1");
  const pending: Pending[] = [];
  const overalls: number[] = [];
  const itemMatrix: number[][] = [];
  const retest: number[] = [];
  const en_scores: number[] = [];
  const ar_scores: number[] = [];
  const sessionSeries: number[] = [];

  const loCount = Math.max(
    2,
    BUILTIN_TEMPLATES[0]?.learning_objectives?.length ?? 2,
  );

  let seed = 1000;
  for (const arch of ARCHETYPES) {
    let profile: LearnerProfile = createLearnerProfile({
      user_id: `eri-${arch.id}`,
      profession:
        arch.id === "medical_student" ? "medical_student" : "psychiatry_resident",
      training_level:
        arch.id === "consultant_psychiatrist"
          ? "fellowship"
          : arch.id.includes("student")
            ? "undergraduate"
            : "residency",
    });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === arch.weak
          ? { ...c, score: Math.max(20, arch.startOverall - 15), samples: 1 }
          : c,
      ),
    };

    for (let s = 0; s < 6; s++) {
      const progress = arch.startOverall + s * arch.learningRate;
      const noise = (rng() - 0.5) * 2 * arch.noise;
      const overall = clamp(progress + noise);
      sessionSeries.push(overall);
      const items = itemsFromOverall(overall, arch.weak);
      const locale = s % 2 === 0 ? "en-US" : "ar-JO";
      if (locale.startsWith("en")) en_scores.push(overall);
      else ar_scores.push(overall);

      overalls.push(overall);
      itemMatrix.push(items.map((i) => i.score));
      retest.push(clamp(overall + (rng() - 0.5) * 4));

      const ingested = ingestSessionAssessment(profile, {
        overall,
        items,
        sessionId: `eri-${arch.id}-${s}`,
        diagnosisSlug: "mdd-recurrent-moderate",
        durationSec: 1200,
        timeLimitSec: 2400,
      });
      profile = ingested.profile;
      const coach = generateSupervisorFeedback(profile, {
        overallScore: overall,
        competencyScores: { [arch.weak]: Math.max(20, overall - 15) },
        sessionId: `eri-${arch.id}-${s}`,
        missFlags:
          overall < 60 ? { missed_suicide_questions: true } : undefined,
      });

      const narrative = [
        `Educational review of ${arch.id} session ${s + 1}.`,
        `Overall ${Math.round(overall)}/100 with focus on ${arch.weak.replace(/_/g, " ")}.`,
        "Clinical reasoning: formulation linked interview findings to differentials and risk.",
        coach.supervisor_feedback,
      ].join(" ");

      pending.push({
        overall,
        items,
        narrative,
        coach,
        locale,
        difficulty: arch.difficulty,
        learner_id: `eri-${arch.id}`,
        session_id: `eri-${arch.id}-${s}`,
        computed_at: new Date(Date.UTC(2026, 7, 1 + s)).toISOString(),
        seed: seed++,
      });
    }
  }

  const psy = summarizePsychometrics({
    overalls,
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

  const a: number[] = [];
  const b: number[] = [];
  for (let i = 1; i < sessionSeries.length; i++) {
    a.push(sessionSeries[i - 1]!);
    b.push(sessionSeries[i]!);
  }
  const interSessionR = pearson(a, b);

  return pending.map((t) => {
    const eri = computeEducationalReliabilityIndex(
      eriInputFromAssessment({
        overall: t.overall,
        items: t.items,
        narrative: t.narrative,
        excerpts: [
          "Therapist: Tell me more about what has been hardest this week.",
          "Patient: I haven't slept; everything feels heavy.",
        ],
        locale: t.locale,
        difficulty: t.difficulty,
        assessment_mode: "simulation",
        coach: t.coach,
        learning_objectives_count: loCount,
        difficulty_matches_learner: true,
        inter_session_r: interSessionR,
        test_retest_r: psy.test_retest_r,
        cronbach_alpha: psy.cronbach_alpha,
        fairness_pass: fairnessPass,
        language_parity_within_tolerance: parity.within_tolerance,
        language_parity_abs_diff: parity.abs_diff,
        learner_id: t.learner_id,
        session_id: t.session_id,
        model_version: "simulation",
        seed: t.seed,
      }),
    );
    return {
      overall: eri.overall,
      locale: t.locale,
      difficulty: t.difficulty,
      assessment_mode: "simulation",
      learner_id: t.learner_id,
      computed_at: t.computed_at,
      eri,
    };
  });
}
