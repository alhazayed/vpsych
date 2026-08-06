import { mean } from "@/lib/scientific/psychometrics";
import { buildConsortFlow } from "./consort";
import { summarizeEducationalOutcomes, type OutcomeRow } from "./outcomes";
import { buildReliabilityReport } from "./reliability";
import type {
  CvpDashboard,
  CvpStudy,
  InstitutionComparisonRow,
} from "./types";

const DISCLAIMER =
  "Clinical Validation Dashboard aggregates formative evidence only. Do not claim validated educational outcomes or superiority without pre-registered analysis and peer review.";

export type DashboardInput = {
  study: CvpStudy | null;
  enrollments: { is_active: boolean; institution_id: string | null }[];
  invitations: { status: string }[];
  assignments: {
    status: string;
    allocation_arm: string;
    enrollment_id: string;
  }[];
  blind: {
    overall_realism: number;
    would_use_in_training: boolean | null;
  }[];
  dualScores: Record<string, Record<string, number>>;
  cronbachMatrix?: number[][];
  institutions: InstitutionComparisonRow[];
  outcomes: OutcomeRow[];
  snapshots: { enrollment_id: string }[];
  calibration: { expert_scores: Record<string, unknown> }[];
  exports: { status: string }[];
  now?: Date;
};

export function buildCvpDashboard(input: DashboardInput): CvpDashboard {
  const now = input.now ?? new Date();
  const active = input.enrollments.filter((e) => e.is_active).length;

  const inv = { pending: 0, accepted: 0, expired: 0 };
  for (const i of input.invitations) {
    if (i.status === "pending") inv.pending += 1;
    else if (i.status === "accepted") inv.accepted += 1;
    else if (i.status === "expired" || i.status === "revoked") inv.expired += 1;
  }

  const asg = {
    pending: 0,
    active: 0,
    completed: 0,
    by_arm: {} as Record<string, number>,
  };
  for (const a of input.assignments) {
    if (a.status === "pending") asg.pending += 1;
    else if (a.status === "active") asg.active += 1;
    else if (a.status === "completed") asg.completed += 1;
    asg.by_arm[a.allocation_arm] = (asg.by_arm[a.allocation_arm] ?? 0) + 1;
  }

  const blindRealism = input.blind.map((b) => b.overall_realism);
  const would = input.blind.filter((b) => b.would_use_in_training === true)
    .length;
  const wouldAnswered = input.blind.filter(
    (b) => b.would_use_in_training != null,
  ).length;

  const snapByEnrollment = new Map<string, number>();
  for (const s of input.snapshots) {
    snapByEnrollment.set(
      s.enrollment_id,
      (snapByEnrollment.get(s.enrollment_id) ?? 0) + 1,
    );
  }
  const reviewersWith2 = [...snapByEnrollment.values()].filter((n) => n >= 2)
    .length;

  const allocatedStandard = asg.by_arm.standard ?? 0;
  const allocatedControl = asg.by_arm.control ?? 0;
  const allocatedBlind = asg.by_arm.blind_challenge ?? 0;

  const reliability = buildReliabilityReport({
    dualScores: input.dualScores,
    cronbachMatrix: input.cronbachMatrix,
    now,
  });

  const outcomes = summarizeEducationalOutcomes(input.outcomes);

  return {
    study: input.study
      ? {
          id: input.study.id,
          slug: input.study.slug,
          title: input.study.title,
          status: input.study.status,
          irb_reference: input.study.irb_reference,
          protocol_version: input.study.protocol_version,
        }
      : null,
    enrollments: { total: input.enrollments.length, active },
    invitations: inv,
    assignments: asg,
    blind_challenge: {
      scores: input.blind.length,
      avg_realism: blindRealism.length
        ? Math.round(mean(blindRealism) * 100) / 100
        : null,
      would_use_pct:
        wouldAnswered === 0
          ? null
          : Math.round((would / wouldAnswered) * 1000) / 10,
    },
    reliability,
    consort: buildConsortFlow({
      invited: input.invitations.length,
      excluded: inv.expired,
      enrolled: input.enrollments.length,
      allocatedStandard,
      allocatedControl,
      allocatedBlind,
      completedAssignments: asg.completed,
      completedOutcomes: outcomes.reduce((s, o) => s + o.post_n, 0),
      analysed: reliability.sample_sessions,
    }),
    institutions: input.institutions,
    outcomes,
    longitudinal: {
      snapshots: input.snapshots.length,
      reviewers_with_2plus_snapshots: reviewersWith2,
    },
    calibration: {
      items: input.calibration.length,
      with_expert_scores: input.calibration.filter(
        (c) => Object.keys(c.expert_scores ?? {}).length > 0,
      ).length,
    },
    exports: {
      completed: input.exports.filter((e) => e.status === "completed").length,
      pending: input.exports.filter(
        (e) => e.status === "pending" || e.status === "running",
      ).length,
    },
    generated_at: now.toISOString(),
    disclaimer: DISCLAIMER,
  };
}
