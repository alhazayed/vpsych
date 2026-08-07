/**
 * Reliability Engine — wraps inter-rater + internal score stability.
 * Does not claim validated instruments.
 */

import { clamp01to100, mean, pearson } from "@/lib/validation/helpers";
import { computeAllInterRater } from "@/lib/validation/inter-rater";
import type {
  ExpertRating,
  InterRaterResult,
  SessionObservables,
} from "@/lib/validation/types";

export function scoreReliability(input: {
  sessions: SessionObservables[];
  ratings: ExpertRating[];
}): {
  overall: number | null;
  inter_rater: InterRaterResult[];
  notes: string[];
} {
  const inter = computeAllInterRater(input.ratings);
  const notes: string[] = [
    "Platform competency scores remain unvalidated for high-stakes use",
    "Reliability estimates require adequate rater × case coverage",
  ];

  if (!input.ratings.length) {
    notes.push("No expert ratings stored — inter-rater metrics unavailable");
  }

  // Internal stability of assessment overalls when ≥2 sessions
  const overalls = input.sessions
    .map((s) => s.assessment?.overall)
    .filter((x): x is number => typeof x === "number");
  if (overalls.length >= 4) {
    const half = Math.floor(overalls.length / 2);
    const r = pearson(overalls.slice(0, half), overalls.slice(half, half * 2));
    if (r != null) {
      notes.push(`split_half_r=${Math.round(r * 1000) / 1000}`);
    }
  }

  const usable = inter.filter((r) => r.domain !== "aggregate");
  const kappaMean = mean(
    usable
      .map((r) => r.cohen_kappa)
      .filter((x): x is number => x != null)
      .map((k) => (k + 1) * 50), // map [-1,1] → [0,100]
  );
  const agreeMean = mean(
    usable
      .map((r) => r.percent_agreement)
      .filter((x): x is number => x != null),
  );

  let overall: number | null = null;
  if (Number.isFinite(kappaMean) || Number.isFinite(agreeMean)) {
    const parts = [kappaMean, agreeMean].filter((x) => Number.isFinite(x));
    overall = clamp01to100(mean(parts));
  }

  if (overall == null) {
    notes.push("overall_reliability=null (insufficient evidence)");
  }

  return { overall, inter_rater: inter, notes };
}
