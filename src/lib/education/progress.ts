/**
 * Longitudinal learning trajectories — 10 / 25 / 50 / 100 session horizons.
 * Deterministic simulation helpers + live projection from LearnerProfile.
 */

import type { LearnerProfile } from "@/lib/ace/types";
import { evaluateCertificationMilestone } from "@/lib/education/certification";
import {
  scoreEducationCompetencies,
  weightedEducationOverall,
} from "@/lib/education/competency-framework";
import type {
  CertificationMilestone,
  EducationCompetencyDomainId,
  LearningTrajectoryPoint,
  LongitudinalHorizon,
  LongitudinalLearningReport,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

const MILESTONE_ORDER: CertificationMilestone[] = [
  "beginner",
  "intermediate",
  "advanced",
  "resident_ready",
  "board_ready",
  "consultant_level",
];

function milestoneAt(overall: number, cases: number): CertificationMilestone {
  if (cases >= 50 && overall >= 85) return "consultant_level";
  if (cases >= 30 && overall >= 78) return "board_ready";
  if (cases >= 15 && overall >= 70) return "resident_ready";
  if (cases >= 8 && overall >= 60) return "advanced";
  if (cases >= 2 && overall >= 45) return "intermediate";
  return "beginner";
}

export function projectLongitudinalLearning(
  profile: LearnerProfile,
  horizon: LongitudinalHorizon = 100,
): LongitudinalLearningReport {
  const scores = scoreEducationCompetencies(profile.competencies);
  const baseOverall = weightedEducationOverall(scores);
  const velocity = profile.learning_velocity || 0.4;
  const points: LearningTrajectoryPoint[] = [];
  let ema = baseOverall;
  let plateau = false;
  let regression = false;
  let prevMilestone = milestoneAt(ema, profile.completed_case_count);

  const start = profile.completed_case_count;
  for (let n = 0; n <= horizon; n += Math.max(1, Math.floor(horizon / 20))) {
    const sessions = start + n;
    // Project mild improvement with diminishing returns; never invent mastery jumps
    const gain = velocity * (1 - ema / 120);
    ema = Math.max(0, Math.min(95, ema + gain * Math.max(1, n / 5)));
    const m = milestoneAt(ema, sessions);
    const mastery_domains = scores
      .filter((s) => s.score >= 80 - Math.max(0, 10 - n / 10))
      .map((s) => s.id);

    if (n >= 10) {
      const window = points.slice(-3).map((p) => p.overall_ema);
      if (window.length >= 3) {
        const delta = Math.abs(window[2]! - window[0]!);
        plateau = delta < 1.5 && ema < 85;
        regression = window[2]! + 2 < window[0]!;
      }
    }

    points.push({
      sessions_completed: sessions,
      overall_ema: Math.round(ema * 10) / 10,
      milestone: m,
      plateau,
      regression,
      mastery_domains: mastery_domains as EducationCompetencyDomainId[],
    });
    prevMilestone = m;
  }

  void prevMilestone;
  const live = evaluateCertificationMilestone(profile);

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    horizon,
    points,
    current_milestone: live.milestone,
    velocity,
    plateau_detected: plateau,
    regression_detected: regression,
    mastery_count: live.mastered_domains,
  };
}

/** Deterministic 100-session learner simulation for tests. */
export function simulateLearnerArc(input: {
  sessions: number;
  startOverall?: number;
  velocity?: number;
}): LongitudinalLearningReport {
  const startOverall = input.startOverall ?? 42;
  const velocity = input.velocity ?? 0.55;
  const points: LearningTrajectoryPoint[] = [];
  let ema = startOverall;
  let plateau = false;
  let regression = false;

  for (let i = 0; i <= input.sessions; i++) {
    ema = Math.max(0, Math.min(92, ema + velocity * (1 - ema / 110)));
    if (i > 0 && i % 17 === 0) {
      // Occasional soft plateau / mild regression for realism in sims
      ema = Math.max(0, ema - 1.2);
    }
    const m = milestoneAt(ema, i);
    if (i >= 10) {
      const w = points.slice(-3).map((p) => p.overall_ema);
      if (w.length >= 3) {
        plateau = Math.abs(w[2]! - w[0]!) < 1.2 && ema < 88;
        regression = w[2]! + 2 < w[0]!;
      }
    }
    points.push({
      sessions_completed: i,
      overall_ema: Math.round(ema * 10) / 10,
      milestone: m,
      plateau,
      regression,
      mastery_domains: [],
    });
  }

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    horizon: (input.sessions >= 100
      ? 100
      : input.sessions >= 50
        ? 50
        : input.sessions >= 25
          ? 25
          : 10) as LongitudinalHorizon,
    points,
    current_milestone: points[points.length - 1]?.milestone ?? "beginner",
    velocity,
    plateau_detected: plateau,
    regression_detected: regression,
    mastery_count: 0,
  };
}

export function milestoneRank(m: CertificationMilestone): number {
  return MILESTONE_ORDER.indexOf(m);
}
