import { computeReviewerAnalytics } from "./indices";
import { meanLikert } from "./indices";
import type {
  CqiSeverity,
  FeatureRequestThemeCount,
  PppBlindScore,
  PppCqiReport,
  PppDashboard,
  PppEducationalOpportunity,
  PppFeatureRequest,
  PppReviewer,
  PppSessionRating,
} from "./types";

export type SessionAggRow = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  max_duration_sec: number | null;
  message_count: number;
};

const EMPTY_SEVERITY: Record<CqiSeverity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  wishlist: 0,
};

const PPP_DISCLAIMER =
  "Indices are formative expert ratings from the Professional Preview cohort — not validated clinical or educational measurement claims.";

export function buildPppDashboard(input: {
  reviewers: Pick<PppReviewer, "is_active">[];
  sessions: SessionAggRow[];
  ratings: PppSessionRating[];
  cqi: Pick<PppCqiReport, "severity" | "status">[];
  opportunities: Pick<PppEducationalOpportunity, "opportunity_type">[];
  featureRequests: Pick<PppFeatureRequest, "theme" | "title">[];
  blindScores: Pick<
    PppBlindScore,
    "overall_realism" | "would_use_in_training"
  >[];
  now?: Date;
}): PppDashboard {
  const now = input.now ?? new Date();
  const activeReviewers = input.reviewers.filter((r) => r.is_active).length;
  const started = input.sessions.length;
  const completed = input.sessions.filter(
    (s) => s.status === "completed" || s.status === "expired",
  ).length;

  const durations: number[] = [];
  const durationPcts: number[] = [];
  const lengths: number[] = [];
  for (const s of input.sessions) {
    lengths.push(s.message_count);
    if (s.ended_at && s.started_at) {
      const sec = Math.max(
        0,
        (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000,
      );
      if (Number.isFinite(sec)) {
        durations.push(sec);
        const max = s.max_duration_sec && s.max_duration_sec > 0
          ? s.max_duration_sec
          : 2400;
        durationPcts.push(Math.min(100, (sec / max) * 100));
      }
    }
  }

  const bySeverity = { ...EMPTY_SEVERITY };
  let openIssues = 0;
  for (const row of input.cqi) {
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    if (row.status === "open" || row.status === "triaged") openIssues += 1;
  }

  const byType: Record<string, number> = {};
  for (const o of input.opportunities) {
    byType[o.opportunity_type] = (byType[o.opportunity_type] ?? 0) + 1;
  }

  const themeMap = new Map<string, { count: number; titles: string[] }>();
  for (const fr of input.featureRequests) {
    const cur = themeMap.get(fr.theme) ?? { count: 0, titles: [] };
    cur.count += 1;
    if (cur.titles.length < 3) cur.titles.push(fr.title);
    themeMap.set(fr.theme, cur);
  }
  const common: FeatureRequestThemeCount[] = [...themeMap.entries()]
    .map(([theme, v]) => ({
      theme,
      count: v.count,
      sample_titles: v.titles,
    }))
    .sort((a, b) => b.count - a.count);

  const blindMeans = input.blindScores.map((b) => b.overall_realism);
  const wouldUse = input.blindScores.filter(
    (b) => b.would_use_in_training === true,
  ).length;
  const wouldUseAnswered = input.blindScores.filter(
    (b) => b.would_use_in_training !== null && b.would_use_in_training !== undefined,
  ).length;

  const avg = (nums: number[]) =>
    nums.length === 0
      ? null
      : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;

  return {
    reviewers: {
      total: input.reviewers.length,
      active: activeReviewers,
    },
    sessions: {
      started,
      completed,
      completion_rate_pct:
        started === 0 ? null : Math.round((completed / started) * 1000) / 10,
      avg_duration_sec: avg(durations),
      avg_duration_pct_of_max: avg(durationPcts),
      avg_conversation_length: avg(lengths),
    },
    ratings: {
      count: input.ratings.length,
      avg_realism: meanLikert(input.ratings.map((r) => r.clinical_realism)),
      avg_educational_value: meanLikert(
        input.ratings.map((r) => r.educational_value),
      ),
    },
    issues: {
      total: input.cqi.length,
      by_severity: bySeverity,
      open: openIssues,
    },
    educational_opportunities: {
      total: input.opportunities.length,
      by_type: byType,
    },
    feature_requests: {
      total: input.featureRequests.length,
      common,
    },
    blind_scores: {
      count: input.blindScores.length,
      avg_overall_realism: meanLikert(blindMeans),
      would_use_pct:
        wouldUseAnswered === 0
          ? null
          : Math.round((wouldUse / wouldUseAnswered) * 1000) / 10,
    },
    indices: computeReviewerAnalytics(input.ratings),
    generated_at: now.toISOString(),
    disclaimer: PPP_DISCLAIMER,
  };
}
