/**
 * Aggregation and rendering for a calibration run.
 *
 * Separated from the harness so that everything except the provider calls is
 * unit-testable: the harness only gathers raw model scores, and every number a
 * human reads is computed here.
 */

import type { RubricItem } from "@/lib/types";
import {
  agreementBetween,
  intraclassCorrelation,
  meanAbsoluteError,
  reliabilityBand,
  selfConsistency,
  type AgreementReport,
  type IccResult,
  type SelfConsistencyReport,
} from "@/lib/ai/reliability";

/** Raw material the harness collects for one calibration case. */
export type CaseRun = {
  caseId: string;
  language: "en" | "ar";
  rubric: RubricItem[];
  /** Mean expert score per rubric item. */
  consensus: Record<string, number>;
  consensusOverall: number;
  interRater: IccResult | null;
  /** One entry per repeated model run: rubric item id → score. */
  modelRuns: Record<string, number>[];
  /** `aiSource` reported by each run — a heuristic run is not a model result. */
  aiSources: string[];
};

export type CaseReliability = {
  caseId: string;
  language: "en" | "ar";
  interRater: IccResult | null;
  stability: SelfConsistencyReport;
  /** Expert consensus vs the mean of the model's runs. */
  agreement: AgreementReport;
  /** Runs that fell back to the heuristic scorer rather than a model. */
  heuristicRuns: number;
};

export type CorpusReliability = {
  cases: CaseReliability[];
  /** Pooled ICC(2,1) over every (case, rubric item), expert vs model. */
  modelVsExpert: IccResult | null;
  meanAbsoluteError: number;
  exactAgreement: number;
  adjacentAgreement: number;
  /** Largest per-item SD seen across repeated runs anywhere in the corpus. */
  worstItemSd: number;
  /** Largest swing in the reported 0–100 score for one unchanged transcript. */
  worstOverallRange: number;
  heuristicRuns: number;
  totalRuns: number;
};

function meanOfRuns(
  runs: Record<string, number>[],
  rubric: RubricItem[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of rubric) {
    const values = runs.map((r) => r[item.id] ?? 0);
    out[item.id] = values.length
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 0;
  }
  return out;
}

export function summarizeCase(run: CaseRun): CaseReliability {
  const stability = selfConsistency({
    runs: run.modelRuns,
    rubric: run.rubric,
  });

  const agreement = agreementBetween({
    reference: run.consensus,
    candidate: meanOfRuns(run.modelRuns, run.rubric),
    rubric: run.rubric,
  });

  return {
    caseId: run.caseId,
    language: run.language,
    interRater: run.interRater,
    stability,
    agreement,
    heuristicRuns: run.aiSources.filter((s) => s === "persona_fallback").length,
  };
}

export function summarizeCorpus(runs: CaseRun[]): CorpusReliability {
  const cases = runs.map(summarizeCase);

  // Pool every (case, rubric item) as one rating unit. Per-case ICC over a
  // five-line rubric is too small to trust; the pooled coefficient is the one
  // worth quoting. Human-vs-human over the same units comes from
  // `corpusInterRaterReliability` in `lib/ai/calibration`.
  const expertVsModel: number[][] = [];
  const referenceVector: number[] = [];
  const candidateVector: number[] = [];

  for (const run of runs) {
    const modelMean = meanOfRuns(run.modelRuns, run.rubric);
    for (const item of run.rubric) {
      const ref = run.consensus[item.id] ?? 0;
      const cand = modelMean[item.id] ?? 0;
      expertVsModel.push([ref, cand]);
      referenceVector.push(ref);
      candidateVector.push(cand);
    }
  }

  const allItems = cases.flatMap((c) => c.agreement.items);

  return {
    cases,
    modelVsExpert: intraclassCorrelation(expertVsModel),
    meanAbsoluteError: meanAbsoluteError(referenceVector, candidateVector),
    exactAgreement: allItems.length
      ? allItems.filter((i) => i.exact).length / allItems.length
      : 0,
    adjacentAgreement: allItems.length
      ? allItems.filter((i) => i.withinOnePoint).length / allItems.length
      : 0,
    worstItemSd: cases.reduce((m, c) => Math.max(m, c.stability.maxItemSd), 0),
    worstOverallRange: cases.reduce(
      (m, c) => Math.max(m, c.stability.overall.range),
      0,
    ),
    heuristicRuns: cases.reduce((s, c) => s + c.heuristicRuns, 0),
    totalRuns: runs.reduce((s, r) => s + r.modelRuns.length, 0),
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function coefficient(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(3)} (${reliabilityBand(value)})`;
}

/** Human-readable report for the terminal / CI log. */
export function renderReliabilityReport(summary: CorpusReliability): string {
  const lines: string[] = [];

  lines.push("Assessment reliability");
  lines.push("======================");
  lines.push("");

  if (summary.cases.length === 0) {
    lines.push("No calibration cases were scored.");
    return lines.join("\n");
  }

  lines.push(
    `Cases: ${summary.cases.length}   Model runs: ${summary.totalRuns}`,
  );
  if (summary.heuristicRuns > 0) {
    lines.push(
      `WARNING: ${summary.heuristicRuns} run(s) fell back to the heuristic scorer — those are not model results.`,
    );
  }
  lines.push("");

  lines.push("Stability (same transcript, repeated runs)");
  lines.push(`  worst per-item SD .......... ${summary.worstItemSd.toFixed(2)}`);
  lines.push(
    `  worst 0-100 score swing .... ${summary.worstOverallRange.toFixed(0)} points`,
  );
  lines.push("");

  lines.push("Agreement with expert consensus");
  lines.push(`  ICC(2,1) ................... ${coefficient(summary.modelVsExpert?.icc ?? null)}`);
  lines.push(`  mean absolute error ........ ${summary.meanAbsoluteError.toFixed(2)} scale points`);
  lines.push(`  exact agreement ............ ${pct(summary.exactAgreement)}`);
  lines.push(`  within one point ........... ${pct(summary.adjacentAgreement)}`);
  lines.push("");

  lines.push("Per case");
  for (const c of summary.cases) {
    lines.push(
      `  ${c.caseId} [${c.language}]  expert ${c.agreement.overall.reference} vs model ${c.agreement.overall.candidate}` +
        `  (MAE ${c.agreement.meanAbsoluteError.toFixed(2)}, run SD ${c.stability.overall.sd.toFixed(1)})`,
    );
    const worst = [...c.agreement.items].sort(
      (a, b) => b.absoluteError - a.absoluteError,
    )[0];
    if (worst && worst.absoluteError > 1) {
      lines.push(
        `      largest gap: ${worst.itemId} — expert ${worst.reference}, model ${worst.candidate}`,
      );
    }
    if (c.interRater) {
      lines.push(
        `      raters agree: ${coefficient(c.interRater.icc)}`,
      );
    }
  }

  return lines.join("\n");
}
