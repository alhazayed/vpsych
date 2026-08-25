/**
 * Test–retest computation for the assessment instrument (Phase 4, Track B item T8).
 *
 * WHY THIS EXISTS SEPARATELY FROM `reliability.ts`
 * Internal consistency (Cronbach's alpha) asks whether items agree with each
 * other within ONE scoring run. Test–retest asks whether the SAME session,
 * scored again, produces the same number. They are different properties and a
 * high alpha says nothing about the second.
 *
 * WHY IT CANNOT BE COMPUTED FROM STORED DATA
 * Milestone F0-2 established that the examiner runs at `temperature: 0.3` — the
 * instrument is non-deterministic. Each stored report is a single draw. Nothing
 * in the corpus records a second scoring of the same transcript, so test–retest
 * is not recoverable retrospectively; it requires deliberate re-runs. This
 * module computes the statistic once those re-runs exist. It does NOT perform
 * them: no model call, no database access, no writes.
 *
 * WHAT IT REFUSES TO DO
 * It does not recompute an overall score (`weightedOverall()` in
 * `lib/ai/assessment.ts` remains the single owner of that formula), does not
 * read narrative or transcript text, and does not describe anything it produces
 * as validating the instrument. Reproducibility is not validity.
 */

import { mean, pearson, stddev } from "@/lib/scientific/psychometrics";

export const TEST_RETEST_HARNESS_VERSION = "1.0.0";

/** Minimum distinct scoring occasions below which nothing is computable. */
export const MIN_OCCASIONS = 2;

/** One scoring run of one session. */
export type ScoringOccasion = {
  /** Identifies the session. Two occasions with the same id are re-scorings of it. */
  session_id: string;
  /** 1-based index of the run. Occasion 1 is the original scoring. */
  occasion: number;
  overall: number;
  items: { id: string; score: number; max: number }[];
  ai_model?: string | null;
  prompt_engine_version?: string | null;
  assessment_mode?: string | null;
};

export type ItemStability = {
  id: string;
  /** Sessions contributing a value on every occasion compared. */
  n: number;
  /** Share of sessions whose raw score was identical across occasions. */
  exact_agreement_rate: number;
  /** Mean absolute difference across occasions, in raw score units. */
  mean_absolute_difference: number;
  /** Largest absolute difference observed for this item. */
  max_absolute_difference: number;
};

export type TestRetestReport = {
  harness_version: string;
  generated_at: string;
  n_sessions: number;
  n_occasions: number;
  /** Pearson r between the first two occasions' overall scores. */
  overall_r: number | null;
  overall_mean_absolute_difference: number;
  overall_max_absolute_difference: number;
  /**
   * Standard error of measurement, SD_pooled * sqrt(1 - r).
   * Null when r is unavailable or negative — a negative r makes the usual SEM
   * formula produce an imaginary number, and reporting 0 instead would read as
   * perfect precision.
   */
  standard_error_of_measurement: number | null;
  items: ItemStability[];
  /** Non-fatal conditions bounding interpretation. Never empty. */
  limitations: string[];
  /** Fatal conditions — nothing here is interpretable. */
  blocking: string[];
};

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function roundOrNull(value: number | null, dp: number): number | null {
  return value == null || Number.isNaN(value) ? null : round(value, dp);
}

/** Group occasions by session, dropping sessions not scored on every occasion. */
function pairedBySession(
  occasions: ScoringOccasion[],
): Map<string, ScoringOccasion[]> {
  const byId = new Map<string, ScoringOccasion[]>();
  for (const o of occasions) {
    const list = byId.get(o.session_id) ?? [];
    list.push(o);
    byId.set(o.session_id, list);
  }
  const occasionCount = new Set(occasions.map((o) => o.occasion)).size;
  const complete = new Map<string, ScoringOccasion[]>();
  for (const [id, list] of byId) {
    // A session missing a run cannot contribute a difference. Dropping it is
    // deliberate: carrying it forward with a filled-in value would understate
    // the very instability this measures.
    if (new Set(list.map((o) => o.occasion)).size === occasionCount) {
      complete.set(id, [...list].sort((a, b) => a.occasion - b.occasion));
    }
  }
  return complete;
}

/**
 * Compute test–retest stability across repeated scorings.
 *
 * Produces `blocking` reasons rather than throwing, so a caller can surface an
 * uninterpretable sample honestly instead of reporting a number anyway.
 */
export function computeTestRetestReport(
  occasions: ScoringOccasion[],
  now: () => Date = () => new Date(),
): TestRetestReport {
  const blocking: string[] = [];
  const limitations: string[] = [];

  const distinctOccasions = new Set(occasions.map((o) => o.occasion)).size;
  const paired = pairedBySession(occasions);
  const sessions = [...paired.values()];

  if (distinctOccasions < MIN_OCCASIONS) {
    blocking.push(
      `Fewer than ${MIN_OCCASIONS} distinct scoring occasions — test–retest is undefined. ` +
        "A single stored report per session cannot yield this statistic; deliberate re-runs are required (F0-2).",
    );
  }
  if (sessions.length < 2) {
    blocking.push(
      "Fewer than 2 sessions scored on every occasion — no correlation is computable.",
    );
  }

  const firstOveralls = sessions.map((runs) => runs[0]!.overall);
  const secondOveralls = sessions.map((runs) => runs[1]?.overall ?? runs[0]!.overall);

  const overallDiffs = sessions.flatMap((runs) =>
    runs.slice(1).map((r) => Math.abs(r.overall - runs[0]!.overall)),
  );

  const r = blocking.length ? null : pearson(firstOveralls, secondOveralls);

  // SD across every occasion, not just the first — the spread the SEM scales.
  const allOveralls = sessions.flatMap((runs) => runs.map((x) => x.overall));
  const sem =
    r == null || r < 0 || !allOveralls.length
      ? null
      : stddev(allOveralls) * Math.sqrt(1 - r);

  // Item ids present on every run of every retained session.
  const itemIds = sessions.length
    ? sessions[0]![0]!.items
        .map((i) => i.id)
        .filter((id) =>
          sessions.every((runs) => runs.every((run) => run.items.some((i) => i.id === id))),
        )
    : [];

  const items: ItemStability[] = itemIds.map((id) => {
    const diffs: number[] = [];
    let exact = 0;
    for (const runs of sessions) {
      const scores = runs.map((run) => run.items.find((i) => i.id === id)!.score);
      const base = scores[0]!;
      const perRun = scores.slice(1).map((s) => Math.abs(s - base));
      diffs.push(...perRun);
      if (perRun.every((d) => d === 0)) exact += 1;
    }
    return {
      id,
      n: sessions.length,
      exact_agreement_rate: sessions.length ? round(exact / sessions.length, 3) : 0,
      mean_absolute_difference: diffs.length ? round(mean(diffs), 3) : 0,
      max_absolute_difference: diffs.length ? round(Math.max(...diffs), 3) : 0,
    };
  });

  // Unconditional — these bound every result this module can produce.
  limitations.push(
    "Test–retest measures reproducibility, not validity. A perfectly reproducible instrument can be reproducibly wrong.",
  );
  limitations.push(
    "The examiner runs at temperature 0.3 (F0-2), so disagreement between occasions is expected by design and is not, on its own, evidence of a defect.",
  );
  limitations.push(
    "Rating dimensions carry no behavioural anchors (F0-1), so instability conflates instrument ambiguity with sampling noise.",
  );

  const dropped = new Set(occasions.map((o) => o.session_id)).size - sessions.length;
  if (dropped > 0) {
    limitations.push(
      `${dropped} session(s) were not scored on every occasion and were excluded rather than filled in.`,
    );
  }

  const models = new Set(
    occasions.map((o) => o.ai_model).filter((m): m is string => Boolean(m)),
  );
  const prompts = new Set(
    occasions.map((o) => o.prompt_engine_version).filter((p): p is string => Boolean(p)),
  );
  if (models.size > 1 || prompts.size > 1) {
    limitations.push(
      "Occasions span more than one model or prompt version. That measures configuration change, not test–retest of one instrument.",
    );
  }
  const fallback = occasions.filter(
    (o) => o.assessment_mode === "heuristic_fallback",
  ).length;
  if (fallback > 0) {
    limitations.push(
      `${fallback} occasion(s) were scored by the HEURISTIC KEYWORD FALLBACK, which is deterministic and not the examiner. ` +
        "Including it inflates apparent stability (F-FIND-3).",
    );
  }

  return {
    harness_version: TEST_RETEST_HARNESS_VERSION,
    generated_at: now().toISOString(),
    n_sessions: sessions.length,
    n_occasions: distinctOccasions,
    overall_r: roundOrNull(r, 3),
    overall_mean_absolute_difference: overallDiffs.length ? round(mean(overallDiffs), 3) : 0,
    overall_max_absolute_difference: overallDiffs.length
      ? round(Math.max(...overallDiffs), 3)
      : 0,
    standard_error_of_measurement: roundOrNull(sem, 3),
    items,
    limitations,
    blocking,
  };
}
