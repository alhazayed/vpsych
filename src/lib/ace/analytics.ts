import type { ScoreEntry } from "@/lib/types";
import { COMPETENCY_IDS, RUBRIC_TO_COMPETENCIES, scoreOf } from "./catalog";
import { meanMerge, trendSlope } from "@/lib/learning-analytics";
import type {
  CompetencyId,
  LearnerCompetency,
  LearnerProfile,
  PerformanceAnalytics,
  SessionPerformanceInput,
} from "./types";

/** Convert session rubric items (0–max) into competency scores 0–100. */
export function mapRubricToCompetencies(
  items: ScoreEntry[],
  overall: number,
): Partial<Record<CompetencyId, number>> {
  const buckets = new Map<CompetencyId, number[]>();
  const bump = (id: CompetencyId, value: number) => {
    const list = buckets.get(id) ?? [];
    list.push(value);
    buckets.set(id, list);
  };

  for (const item of items) {
    const pct = item.max > 0 ? (item.score / item.max) * 100 : overall;
    const mapped = RUBRIC_TO_COMPETENCIES[item.id] ?? [];
    for (const c of mapped) bump(c, Math.round(pct));
  }

  // Ensure core competencies always get a signal from overall
  if (!buckets.has("diagnostic_interview")) {
    bump("diagnostic_interview", Math.round(overall));
  }
  if (!buckets.has("professional_communication")) {
    bump("professional_communication", Math.round(overall * 0.95));
  }

  const out: Partial<Record<CompetencyId, number>> = {};
  for (const [id, values] of buckets) {
    out[id] = meanMerge(values);
  }
  return out;
}

/** Exponential moving average update for a competency score. */
export function updateCompetencyEma(
  current: LearnerCompetency | undefined,
  newScore: number,
  alpha = 0.35,
): LearnerCompetency {
  const prev = current?.score ?? 50;
  const samples = (current?.samples ?? 0) + 1;
  const score = Math.max(
    0,
    Math.min(100, Math.round(prev * (1 - alpha) + newScore * alpha)),
  );
  const trend = score - prev;
  return {
    competency_id: (current?.competency_id ??
      "diagnostic_interview") as CompetencyId,
    score,
    samples,
    trend,
    last_assessed_at: new Date().toISOString(),
    mastered_at:
      score >= 80 && samples >= 3
        ? (current?.mastered_at ?? new Date().toISOString())
        : current?.mastered_at ?? null,
  };
}

/**
 * Assessed competencies only (samples > 0).
 * Unassessed baseline rows (score 70 / samples 0) must not dilute analytics.
 */
export function assessedCompetencies(
  competencies: LearnerCompetency[],
): LearnerCompetency[] {
  return competencies.filter((c) => c.samples > 0);
}

export function applySessionPerformance(
  profile: LearnerProfile,
  input: SessionPerformanceInput,
): LearnerProfile {
  const byId = new Map(
    profile.competencies.map((c) => [c.competency_id, { ...c }]),
  );

  const updatedIds: CompetencyId[] = [];

  for (const [rawId, rawScore] of Object.entries(input.competencyScores)) {
    const id = rawId as CompetencyId;
    if (!COMPETENCY_IDS.includes(id)) continue;
    let score = rawScore as number;

    // Miss flags pull specific competencies down
    const flags = input.missFlags ?? {};
    if (id === "suicide_assessment" && flags.missed_suicide_questions) {
      score = Math.min(score, 40);
    }
    if (id === "violence_assessment" && flags.missed_violence_assessment) {
      score = Math.min(score, 40);
    }
    if (id === "dsm5_reasoning" && flags.missed_dsm_criteria) {
      score = Math.min(score, 45);
    }
    if (id === "icd11_reasoning" && flags.missed_icd_criteria) {
      score = Math.min(score, 45);
    }
    if (id === "medication_management" && flags.incorrect_medications) {
      score = Math.min(score, 35);
    }
    if (
      id === "differential_diagnosis" &&
      input.correctDiagnosis === false
    ) {
      score = Math.min(score, 50);
    }

    const updated = updateCompetencyEma(byId.get(id), score);
    updated.competency_id = id;
    byId.set(id, updated);
    updatedIds.push(id);
  }

  // Fill missing competencies with neutral baseline (unassessed)
  for (const id of COMPETENCY_IDS) {
    if (!byId.has(id)) {
      byId.set(id, {
        competency_id: id,
        score: 70,
        samples: 0,
        trend: 0,
      });
    }
  }

  const competencies = [...byId.values()];
  const assessed = assessedCompetencies(competencies);
  const avg =
    assessed.length > 0
      ? assessed.reduce((s, c) => s + c.score, 0) / assessed.length
      : profile.confidence_score;

  const history = [
    ...((profile.metadata?.history_overall as number[]) ?? []),
    input.overallScore,
  ];
  const slope = trendSlope(history);
  // Learning velocity: blend OLS assessment trend with assessed positive share
  const positiveTrends = assessed.filter((c) => c.trend > 0).length;
  const positiveShare =
    assessed.length > 0 ? positiveTrends / assessed.length : 0;
  const velocity =
    profile.learning_velocity * 0.5 +
    slope * 0.3 +
    positiveShare * 0.2 +
    (input.overallScore - 60) / 200;

  return {
    ...profile,
    competencies,
    completed_case_count: profile.completed_case_count + 1,
    learning_velocity: Math.round(velocity * 100) / 100,
    confidence_score: Math.max(
      0,
      Math.min(100, Math.round(avg * 0.6 + profile.confidence_score * 0.4)),
    ),
    metadata: {
      ...profile.metadata,
      last_overall: input.overallScore,
      last_diagnosis: input.diagnosisSlug ?? null,
      last_session_competency_ids: updatedIds,
    },
  };
}

export function buildAnalytics(
  profile: LearnerProfile,
  historyOverall: number[] = [],
  completedDiagnoses: string[] = [],
  missedDiagnoses: string[] = [],
): PerformanceAnalytics {
  const threshold = profile.min_competency_threshold;
  const assessed = assessedCompetencies(profile.competencies);

  const radar = COMPETENCY_IDS.map((id) => {
    const row = profile.competencies.find((c) => c.competency_id === id);
    return {
      competency_id: id,
      score: row && row.samples > 0 ? row.score : scoreOf(profile.competencies, id, 0),
      samples: row?.samples ?? 0,
    };
  });

  const assessedRadar = radar.filter((r) => (r.samples ?? 0) > 0);
  const sorted = [...assessedRadar].sort((a, b) => b.score - a.score);
  const strengths = sorted
    .filter((r) => r.score >= 80)
    .map((r) => r.competency_id);
  const weaknesses = sorted
    .filter((r) => r.score < threshold)
    .map((r) => r.competency_id);
  const blind_spots = profile.competencies
    .filter(
      (c) =>
        c.samples === 0 ||
        (c.samples < 2 && c.score < threshold),
    )
    .map((c) => c.competency_id);

  const readiness =
    weaknesses.length === 0 && assessed.length >= 5
      ? 90
      : Math.max(
          10,
          Math.round(
            100 -
              weaknesses.length * 8 +
              profile.learning_velocity * 10 -
              Math.max(0, 5 - assessed.length) * 4,
          ),
        );

  return {
    learner_id: profile.id,
    radar: radar.map(({ competency_id, score }) => ({ competency_id, score })),
    strengths: strengths.slice(0, 8),
    weaknesses: weaknesses.slice(0, 8),
    blind_spots: blind_spots.slice(0, 6),
    learning_curve: historyOverall.map((overall, i) => ({
      n: i + 1,
      overall,
    })),
    completed_diagnoses: [...new Set(completedDiagnoses)],
    missed_diagnoses: [...new Set(missedDiagnoses)],
    learning_velocity: profile.learning_velocity,
    confidence_score: profile.confidence_score,
    certification_readiness: Math.min(100, readiness),
    certification_status: profile.certification_status,
  };
}

export function inferMissFlagsFromNarrative(narrative: string): {
  missed_suicide_questions?: boolean;
  missed_dsm_criteria?: boolean;
  missed_bipolar_screening?: boolean;
  missed_violence_assessment?: boolean;
  incorrect_medications?: boolean;
} {
  const n = narrative.toLowerCase();
  return {
    missed_suicide_questions:
      /suicid|safety|self-harm|risk/.test(n) &&
      /miss|did not|failed|omit|neglect|under/.test(n),
    missed_dsm_criteria: /dsm|criteria/.test(n) && /miss|incomplete/.test(n),
    missed_bipolar_screening:
      /bipolar|mania|hypomania/.test(n) && /miss|screen|fail/.test(n),
    missed_violence_assessment:
      /violen|homicid|harm.?to.?other/.test(n) &&
      /miss|did not|failed|omit|neglect/.test(n),
    incorrect_medications:
      /medicat|pharma|prescri/.test(n) &&
      /incorrect|wrong|inappropriate|miss/.test(n),
  };
}

/**
 * Infer diagnosis correctness only from explicit narrative evidence.
 * Returns undefined when unknown — never fabricate from overall score.
 */
export function inferDiagnosisCorrectness(
  narrative: string | undefined,
  overall: number,
): boolean | undefined {
  if (!narrative?.trim()) return undefined;
  const n = narrative.toLowerCase();
  if (
    /\bcorrect\s+diagnos|\baccurate\s+diagnos|\bdiagnos(is|ed)\s+correctly/.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /\bincorrect\s+diagnos|\bmisdiagnos|\bwrong\s+diagnos|\bfailed\s+to\s+diagnos|\bmissed\s+the\s+diagnos/.test(
      n,
    )
  ) {
    return false;
  }
  // Strong differential miss language with poor overall → incorrect
  if (
    overall < 40 &&
    /differential/.test(n) &&
    /miss|incomplete|fail/.test(n)
  ) {
    return false;
  }
  return undefined;
}
