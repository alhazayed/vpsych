/**
 * Full educational journey simulator — ≥50 assessments per learner role.
 */

import { createRng } from "@/lib/case-engine/generator";
import { findDisorderBySlug } from "@/lib/case-engine/catalog";
import {
  createLearnerProfile,
  ingestSessionAssessment,
} from "@/lib/ace/engine";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import { generateSupervisorFeedback } from "@/lib/ace/coach";
import { scoreOf } from "@/lib/ace/catalog";
import {
  generateGraphAwareAdaptiveCase,
  graphSupervisorForProfile,
} from "@/lib/cge/ace-bridge";
import { applyCompetencyDecay } from "@/lib/cge/decay";
import { statesFromAceCompetencies } from "@/lib/cge/engine";
import type { CompetencyId, LearnerProfile } from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";
import {
  AbilityTier,
  MIN_SESSIONS_PER_LEARNER,
  PROFESSION_JOURNEYS,
  ProfessionJourneySpec,
  TIER_PARAMS,
} from "./journeys";
import {
  analyzeReliability,
  analyzeRetention,
  assessedMean,
  buildGrowthReport,
  computeEffectivenessScore,
  focusMean,
  type ReliabilityReport,
  type RetentionReport,
  type TierOutcome,
} from "./metrics";

const COMPLEXITY_MARKERS = [
  "resistance",
  "diagnostic_uncertainty",
  "comorbidity",
  "masking",
  "time_pressure",
  "limited_disclosure",
  "diagnostic_ambiguity",
  "mixed_presentation",
];

function syntheticItems(
  overall: number,
  bias: Partial<Record<string, number>>,
): ScoreEntry[] {
  const mk = (id: string, score5: number): ScoreEntry => ({
    id,
    label: id,
    score: score5,
    max: 5,
    weight: 20,
    feedback: "",
  });
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
  return [
    mk("alliance", to5(bias.alliance ?? overall)),
    mk("assessment", to5(bias.assessment ?? overall)),
    mk("interventions", to5(bias.interventions ?? overall)),
    mk("safety", to5(bias.safety ?? overall)),
    mk("structure", to5(bias.structure ?? overall)),
  ];
}

function seedProfile(
  spec: ProfessionJourneySpec,
  tier: AbilityTier,
  id: string,
): LearnerProfile {
  const params = TIER_PARAMS[tier];
  let profile = createLearnerProfile({
    id,
    user_id: `edu-${id}`,
    profession: spec.profession,
    training_level: spec.training_level,
  });
  profile = {
    ...profile,
    competencies: profile.competencies.map((c) => {
      if (spec.focus.includes(c.competency_id)) {
        return {
          ...c,
          score: params.focusStart,
          samples: 1,
          last_assessed_at: new Date().toISOString(),
        };
      }
      if (spec.reasoning.includes(c.competency_id)) {
        return {
          ...c,
          score: Math.max(30, params.focusStart - 8),
          samples: 1,
          last_assessed_at: new Date().toISOString(),
        };
      }
      return c;
    }),
  };
  return profile;
}

function sessionPerformance(
  tier: AbilityTier,
  sessionIndex: number,
  focusIds: CompetencyId[],
  rng: () => number,
): {
  overall: number;
  bias: Record<string, number>;
} {
  const p = TIER_PARAMS[tier];
  // Asymptotic improvement toward ceiling with diminishing returns
  const progress = 1 - Math.exp((-p.learnRate * (sessionIndex + 1)) / 12);
  const raw =
    p.startOverall +
    (p.ceiling - p.startOverall) * progress +
    (rng() - 0.5) * p.noise;
  const overall = Math.max(15, Math.min(p.ceiling, Math.round(raw)));

  // Map focus to rubric dimensions
  const safetyFocus = focusIds.some((f) =>
    ["suicide_assessment", "risk_assessment", "violence_assessment", "emergency_psychiatry"].includes(
      f,
    ),
  );
  const interventionFocus = focusIds.some((f) =>
    [
      "cbt_skills",
      "dbt_skills",
      "supportive_therapy",
      "motivational_interviewing",
      "medication_management",
    ].includes(f),
  );
  const assessmentFocus = focusIds.some((f) =>
    [
      "diagnostic_interview",
      "mental_status_examination",
      "differential_diagnosis",
      "dsm5_reasoning",
    ].includes(f),
  );
  const allianceFocus = focusIds.some((f) =>
    ["therapeutic_alliance", "empathy", "professional_communication"].includes(
      f,
    ),
  );

  const focusBoost = Math.round((overall - p.startOverall) * 0.9);
  return {
    overall,
    bias: {
      safety: safetyFocus
        ? Math.min(p.ceiling, p.focusStart + focusBoost + (rng() - 0.5) * p.noise)
        : overall * 0.9,
      assessment: assessmentFocus
        ? Math.min(p.ceiling, p.focusStart + focusBoost + (rng() - 0.5) * p.noise)
        : overall * 0.95,
      interventions: interventionFocus
        ? Math.min(p.ceiling, p.focusStart + focusBoost + (rng() - 0.5) * p.noise)
        : overall * 0.9,
      alliance: allianceFocus
        ? Math.min(p.ceiling, p.focusStart + focusBoost + (rng() - 0.5) * p.noise)
        : 65 + sessionIndex * 0.3,
      structure: 60 + sessionIndex * 0.4 + (rng() - 0.5) * 4,
    },
  };
}

export type JourneyResult = {
  profession: AceProfessionLike;
  label: string;
  tiers: TierOutcome[];
  feedback_usefulness: {
    mean_feedback_length: number;
    mean_reflective_questions: number;
    mean_learning_goals: number;
    ok: boolean;
  };
  clinical_reasoning_delta: number;
  adaptive_curriculum_ok: boolean;
  competency_graph_ok: boolean;
  assessment_quality_ok: boolean;
  consistency_ok: boolean;
};

type AceProfessionLike = ProfessionJourneySpec["profession"];

function runTierJourney(
  spec: ProfessionJourneySpec,
  tier: AbilityTier,
  sessions: number,
  seed: string,
): {
  outcome: TierOutcome;
  feedbackLens: number[];
  reflectiveCounts: number[];
  goalCounts: number[];
  reasoningStart: number;
  reasoningEnd: number;
  adaptiveHits: number;
  graphHits: number;
  impossibleDx: number;
} {
  const rng = createRng(seed);
  let profile = seedProfile(spec, tier, `${spec.profession}-${tier}`);
  const startFocus = focusMean(profile.competencies, spec.focus);
  const reasoningStart = focusMean(profile.competencies, spec.reasoning);
  const curve: number[] = [];
  const fingerprints: string[] = [];
  let complexityHits = 0;
  let remediationHits = 0;
  let adaptiveHits = 0;
  let graphHits = 0;
  let impossibleDx = 0;
  const feedbackLens: number[] = [];
  const reflectiveCounts: number[] = [];
  const goalCounts: number[] = [];

  for (let s = 0; s < sessions; s++) {
    const nextCase = generateAdaptiveCase(profile, {
      seed: `${seed}:ace:${s}`,
      priorFingerprints: fingerprints,
      stepIndex: s,
    });
    const graphCase = generateGraphAwareAdaptiveCase(profile, {
      seed: `${seed}:cge:${s}`,
      priorFingerprints: fingerprints,
      observedFailure: spec.focus[0],
    });
    fingerprints.push(nextCase.fingerprint);

    if (!findDisorderBySlug(nextCase.disorderSlug ?? "")) impossibleDx += 1;

    const focusesFocus = nextCase.focusCompetencies.some((f) =>
      spec.focus.includes(f),
    );
    if (focusesFocus || graphCase.rootCause) adaptiveHits += 1;
    if (graphCase.rootCause) graphHits += 1;

    if (nextCase.adaptations.some((a) => COMPLEXITY_MARKERS.includes(a))) {
      complexityHits += 1;
    }
    if (
      scoreOf(profile.competencies, spec.focus[0]!) <
        profile.min_competency_threshold &&
      (nextCase.focusCompetencies.includes(spec.focus[0]!) ||
        graphCase.focusCompetencies.includes(spec.focus[0]!))
    ) {
      remediationHits += 1;
    }

    const perf = sessionPerformance(tier, s, spec.focus, rng);
    const items = syntheticItems(perf.overall, perf.bias);
    const result = ingestSessionAssessment(profile, {
      overall: perf.overall,
      items,
      sessionId: `${seed}-sess-${s}`,
      diagnosisSlug: nextCase.disorderSlug,
      // Explicit when clearly above/below; else unknown (no fabrication)
      correctDiagnosis:
        perf.overall >= 75 ? true : perf.overall < 40 ? false : undefined,
    });
    profile = result.profile;
    curve.push(perf.overall);

    const coach = generateSupervisorFeedback(profile, result.performance);
    const graphReport = graphSupervisorForProfile(profile, spec.focus[0]);
    feedbackLens.push(
      coach.supervisor_feedback.length +
        (graphReport.supervisor_feedback?.length ?? 0),
    );
    reflectiveCounts.push(coach.reflective_questions.length);
    goalCounts.push(coach.learning_goals.length);
  }

  const endFocus = focusMean(profile.competencies, spec.focus);
  const reasoningEnd = focusMean(profile.competencies, spec.reasoning);
  const growth = buildGrowthReport(curve, startFocus, endFocus, profile);

  const improved = growth.delta_focus >= 5 || growth.delta_overall >= 8;
  const increasing_challenge =
    tier === "excellent"
      ? complexityHits >= Math.floor(sessions * 0.15)
      : complexityHits >= 0;

  return {
    outcome: {
      tier,
      improved,
      increasing_challenge,
      complexity_hits: complexityHits,
      remediation_hits: remediationHits,
      growth,
    },
    feedbackLens,
    reflectiveCounts,
    goalCounts,
    reasoningStart,
    reasoningEnd,
    adaptiveHits,
    graphHits,
    impossibleDx,
  };
}

function runProfessionJourney(
  spec: ProfessionJourneySpec,
  sessions = MIN_SESSIONS_PER_LEARNER,
): JourneyResult {
  const tiers: AbilityTier[] = ["weak", "average", "excellent"];
  const tierResults = tiers.map((tier) =>
    runTierJourney(spec, tier, sessions, `edu:${spec.profession}:${tier}`),
  );

  const feedbackLens = tierResults.flatMap((t) => t.feedbackLens);
  const reflectiveCounts = tierResults.flatMap((t) => t.reflectiveCounts);
  const goalCounts = tierResults.flatMap((t) => t.goalCounts);
  const meanFeedback = feedbackLens.reduce((a, b) => a + b, 0) / feedbackLens.length;
  const meanReflective =
    reflectiveCounts.reduce((a, b) => a + b, 0) / reflectiveCounts.length;
  const meanGoals = goalCounts.reduce((a, b) => a + b, 0) / goalCounts.length;

  const reasoningDelta = mean(
    tierResults.map((t) => t.reasoningEnd - t.reasoningStart),
  );
  const adaptiveOk = tierResults.every(
    (t) => t.adaptiveHits >= sessions * 0.4,
  );
  const graphOk = tierResults.every((t) => t.graphHits >= sessions * 0.3);
  const assessmentOk = tierResults.every((t) => t.impossibleDx === 0);
  const consistencyOk = tierResults.every(
    (t) => t.outcome.growth.sessions === sessions,
  );

  return {
    profession: spec.profession,
    label: spec.label,
    tiers: tierResults.map((t) => t.outcome),
    feedback_usefulness: {
      mean_feedback_length: Math.round(meanFeedback),
      mean_reflective_questions: Math.round(meanReflective * 10) / 10,
      mean_learning_goals: Math.round(meanGoals * 10) / 10,
      ok: meanFeedback >= 80 && meanReflective >= 2 && meanGoals >= 1,
    },
    clinical_reasoning_delta: Math.round(reasoningDelta * 10) / 10,
    adaptive_curriculum_ok: adaptiveOk,
    competency_graph_ok: graphOk,
    assessment_quality_ok: assessmentOk,
    consistency_ok: consistencyOk,
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Reliability: identical performance inputs → stable competency EMA. */
export function runReliabilityProbe(
  repeats = 12,
): ReliabilityReport {
  const scores: number[] = [];
  const items = syntheticItems(72, {
    safety: 70,
    assessment: 74,
    interventions: 68,
    alliance: 75,
    structure: 70,
  });
  for (let i = 0; i < repeats; i++) {
    let profile = createLearnerProfile({
      id: `rel-${i}`,
      user_id: `urel-${i}`,
    });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "diagnostic_interview"
          ? { ...c, score: 60, samples: 2 }
          : c,
      ),
    };
    const result = ingestSessionAssessment(profile, {
      overall: 72,
      items,
      sessionId: `rel-sess-${i}`,
      diagnosisSlug: "mdd-recurrent-moderate",
      correctDiagnosis: true,
    });
    scores.push(
      scoreOf(result.profile.competencies, "diagnostic_interview"),
    );
  }
  return analyzeReliability(scores);
}

/** Retention: train, idle 75 days with decay, measure confidence retention. */
export function runRetentionProbe(gapDays = 75): RetentionReport {
  const spec = PROFESSION_JOURNEYS[1]!; // psychiatry resident
  let profile = seedProfile(spec, "average", "retention-probe");
  const rng = createRng("edu:retention:apply");
  for (let s = 0; s < 30; s++) {
    const nextCase = generateAdaptiveCase(profile, {
      seed: `ret:${s}`,
      stepIndex: s,
    });
    const perf = sessionPerformance("average", s, spec.focus, rng);
    const result = ingestSessionAssessment(profile, {
      overall: perf.overall,
      items: syntheticItems(perf.overall, perf.bias),
      sessionId: `ret-sess-${s}`,
      diagnosisSlug: nextCase.disorderSlug,
      correctDiagnosis: true,
    });
    profile = {
      ...result.profile,
      competencies: result.profile.competencies.map((c) => ({
        ...c,
        last_assessed_at: new Date(
          Date.now() - gapDays * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })),
    };
  }
  const pre = focusMean(profile.competencies, spec.focus);
  const states = statesFromAceCompetencies(profile.competencies).map((s) => ({
    ...s,
    last_practiced_at: new Date(
      Date.now() - gapDays * 24 * 60 * 60 * 1000,
    ).toISOString(),
    confidence: Math.round(s.score * 0.7 + 15),
  }));
  const decayed = applyCompetencyDecay(states);
  const focusStates = decayed.states.filter((s) =>
    spec.focus.includes(s.competency_id as CompetencyId),
  );
  const meanConfRatio =
    focusStates.length > 0
      ? mean(
          focusStates.map((s) => {
            const prev = states.find((x) => x.competency_id === s.competency_id);
            return prev && prev.confidence > 0
              ? s.confidence / prev.confidence
              : 1;
          }),
        )
      : 1;
  const post = pre * meanConfRatio;
  return analyzeRetention(pre, post, gapDays);
}

export type EducationalOutcomesReport = {
  generated_at: string;
  sessions_per_learner: number;
  journeys: JourneyResult[];
  reliability: ReliabilityReport;
  retention: RetentionReport;
  board: {
    weak_learners_improve: boolean;
    average_learners_progress: boolean;
    excellent_learners_challenged: boolean;
    mean_focus_delta: number;
    feedback_ok: boolean;
    adaptive_ok: boolean;
    graph_ok: boolean;
    assessment_ok: boolean;
    consistency_ok: boolean;
    clinical_reasoning_ok: boolean;
    effectiveness_score: number;
    verdict: "FAILED" | "WITH_RECOMMENDATIONS" | "CERTIFIED";
  };
};

export function runEducationalOutcomesCertification(
  sessionsPerLearner = MIN_SESSIONS_PER_LEARNER,
): EducationalOutcomesReport {
  const journeys = PROFESSION_JOURNEYS.map((spec) =>
    runProfessionJourney(spec, sessionsPerLearner),
  );
  const reliability = runReliabilityProbe(12);
  const retention = runRetentionProbe(75);

  const allTiers = journeys.flatMap((j) => j.tiers);
  const weak = allTiers.filter((t) => t.tier === "weak");
  const average = allTiers.filter((t) => t.tier === "average");
  const excellent = allTiers.filter((t) => t.tier === "excellent");

  const weakImproved = weak.every((t) => t.improved && t.growth.delta_focus > 0);
  const averageProgressed = average.every(
    (t) => t.growth.delta_focus >= 4 || t.growth.curve_slope > 0,
  );
  const excellentChallenged = excellent.every((t) => t.increasing_challenge);
  const meanFocusDelta = mean(allTiers.map((t) => t.growth.delta_focus));
  const minWeakDelta = Math.min(...weak.map((t) => t.growth.delta_focus));
  const feedbackOk = journeys.every((j) => j.feedback_usefulness.ok);
  const adaptiveOk = journeys.every((j) => j.adaptive_curriculum_ok);
  const graphOk = journeys.every((j) => j.competency_graph_ok);
  const assessmentOk = journeys.every((j) => j.assessment_quality_ok);
  const consistencyOk = journeys.every((j) => j.consistency_ok);
  const clinicalReasoningOk = journeys.every(
    (j) => j.clinical_reasoning_delta >= 2,
  );

  const { score, verdict } = computeEffectivenessScore({
    weakImproved,
    averageProgressed,
    excellentChallenged,
    meanDeltaFocus: meanFocusDelta,
    minWeakDelta,
    reliabilityOk: reliability.acceptable,
    retentionOk: retention.acceptable,
    retentionRatio: retention.retained_ratio,
    feedbackOk,
    adaptiveOk,
    graphOk,
    consistencyOk: consistencyOk && clinicalReasoningOk,
  });

  return {
    generated_at: new Date().toISOString(),
    sessions_per_learner: sessionsPerLearner,
    journeys,
    reliability,
    retention,
    board: {
      weak_learners_improve: weakImproved,
      average_learners_progress: averageProgressed,
      excellent_learners_challenged: excellentChallenged,
      mean_focus_delta: Math.round(meanFocusDelta * 10) / 10,
      feedback_ok: feedbackOk,
      adaptive_ok: adaptiveOk,
      graph_ok: graphOk,
      assessment_ok: assessmentOk,
      consistency_ok: consistencyOk,
      clinical_reasoning_ok: clinicalReasoningOk,
      effectiveness_score: score,
      verdict,
    },
  };
}

export { assessedMean, focusMean };
