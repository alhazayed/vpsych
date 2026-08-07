/**
 * Psychometric Engine — validity facets over observational score matrices.
 * Never fabricates statistical significance.
 */

import {
  cronbachAlpha,
  mean,
  pearson,
  stddev,
  summarizePsychometrics,
} from "@/lib/scientific/psychometrics";
import { clamp01to100 } from "@/lib/validation/helpers";
import type {
  PsychometricValidityKind,
  PsychometricValidityResult,
  SessionObservables,
} from "@/lib/validation/types";

function base(
  kind: PsychometricValidityKind,
  score: number | null,
  n: number,
  evidence: string[],
  limitations: string[],
): PsychometricValidityResult {
  return {
    kind,
    score: score == null ? null : clamp01to100(score),
    n,
    evidence,
    significance_claimed: false,
    limitations,
  };
}

export function evaluatePsychometrics(
  sessions: SessionObservables[],
): PsychometricValidityResult[] {
  const overalls = sessions
    .map((s) => s.assessment?.overall)
    .filter((x): x is number => typeof x === "number");
  const itemMatrix = sessions
    .map((s) =>
      (s.assessment?.items ?? []).map((it) =>
        it.max > 0 ? (it.score / it.max) * 100 : it.score,
      ),
    )
    .filter((row) => row.length > 0);

  const summary = summarizePsychometrics({
    overalls: overalls.length ? overalls : [0],
    itemMatrix: itemMatrix.length ? itemMatrix : [[0, 0]],
  });

  const results: PsychometricValidityResult[] = [];

  const alpha =
    itemMatrix.length >= 2 && (itemMatrix[0]?.length ?? 0) >= 2
      ? cronbachAlpha(itemMatrix)
      : null;
  results.push(
    base(
      "internal_consistency",
      alpha == null ? null : alpha * 100,
      overalls.length,
      [
        `cronbach_alpha=${alpha ?? "null"}`,
        `n_scores=${summary.n_scores}`,
      ],
      [
        "Alpha requires multi-item matrices; null when underpowered",
        "significance_claimed=false",
      ],
    ),
  );

  // Face validity — structural presence of rubric + narrative
  const withRubric = sessions.filter(
    (s) => (s.assessment?.items.length ?? 0) >= 3,
  ).length;
  const face =
    sessions.length === 0
      ? null
      : clamp01to100((withRubric / sessions.length) * 100);
  results.push(
    base(
      "face_validity",
      face,
      sessions.length,
      ["rubric_item_coverage"],
      ["Heuristic face check — not a clinician panel study"],
    ),
  );

  // Content validity — clinical core richness flags
  const contentScores = sessions.map((s) => {
    const c = s.clinical;
    return (
      (c.has_mse ? 25 : 0) +
      (c.has_protective_factors ? 25 : 0) +
      (c.symptom_count > 0 ? 25 : 0) +
      (c.dsm5_code || c.icd11_code ? 25 : 0)
    );
  });
  results.push(
    base(
      "content_validity",
      contentScores.length ? mean(contentScores) : null,
      contentScores.length,
      ["clinical_core_coverage"],
      ["Blueprint coverage proxy — not expert content panel"],
    ),
  );

  // Construct — correlation of overall with turn engagement
  const turns = sessions.map((s) => s.turn_count);
  const construct =
    overalls.length === turns.length && overalls.length >= 3
      ? pearson(overalls, turns)
      : null;
  results.push(
    base(
      "construct_validity",
      construct == null ? null : Math.abs(construct) * 100,
      overalls.length,
      [`|r(overall,turns)|=${construct ?? "null"}`],
      ["Exploratory association only — no causal claim"],
    ),
  );

  // Criterion — unavailable without external OSCE gold
  results.push(
    base("criterion_validity", null, 0, ["no_external_criterion_corpus"], [
      "External OSCE / human examiner criterion study not on main",
      "significance_claimed=false",
    ]),
  );

  // Convergent — ledger clinical_fidelity vs assessment overall when present
  const pairs = sessions
    .map((s) => ({
      a: s.assessment?.overall,
      b: s.ledger_metrics?.clinical_fidelity ?? s.ledger_metrics?.CFI,
    }))
    .filter(
      (p): p is { a: number; b: number } =>
        typeof p.a === "number" && typeof p.b === "number",
    );
  const conv =
    pairs.length >= 3
      ? pearson(
          pairs.map((p) => p.a),
          pairs.map((p) => p.b),
        )
      : null;
  results.push(
    base(
      "convergent_validity",
      conv == null ? null : Math.abs(conv) * 100,
      pairs.length,
      [`pairs=${pairs.length}`],
      ["Requires sealed ledger metrics; null when absent"],
    ),
  );

  // Discriminant — locale groups should not wildly diverge without cause
  const byLocale = new Map<string, number[]>();
  for (const s of sessions) {
    if (s.assessment == null) continue;
    const arr = byLocale.get(s.clinical.locale) ?? [];
    arr.push(s.assessment.overall);
    byLocale.set(s.clinical.locale, arr);
  }
  const localeMeans = [...byLocale.values()]
    .filter((xs) => xs.length >= 2)
    .map((xs) => mean(xs));
  let disc: number | null = null;
  if (localeMeans.length >= 2) {
    const spread = stddev(localeMeans);
    disc = clamp01to100(100 - Math.min(40, spread * 2));
  }
  results.push(
    base("discriminant_validity", disc, localeMeans.length, [
      `locale_groups=${byLocale.size}`,
    ], ["Locale parity heuristic — not multi-trait multi-method"]),
  );

  // Known-groups — difficulty bands
  const byDiff = new Map<string, number[]>();
  for (const s of sessions) {
    if (s.assessment == null || !s.clinical.difficulty) continue;
    const arr = byDiff.get(s.clinical.difficulty) ?? [];
    arr.push(s.assessment.overall);
    byDiff.set(s.clinical.difficulty, arr);
  }
  const known =
    byDiff.size >= 2
      ? clamp01to100(
          50 +
            Math.min(
              40,
              stddev(
                [...byDiff.values()].map((xs) => mean(xs)),
              ),
            ),
        )
      : null;
  results.push(
    base("known_groups_validity", known, byDiff.size, [
      `difficulty_groups=${byDiff.size}`,
    ], ["Known-groups proxy via difficulty — requires confirmed expert grouping"]),
  );

  return results;
}
