/**
 * Publication Engine — methods, tables, figures, limitations.
 * Never invents results.
 */

import { mean, stddev } from "@/lib/validation/helpers";
import {
  VALIDATION_ALGORITHM_VERSION,
  VALIDATION_VERSION,
} from "@/lib/validation/versions";
import type {
  PublicationSupportPackage,
  ValidationDashboardSnapshot,
  ValidationRunResult,
} from "@/lib/validation/types";

const DISCLAIMER =
  "VPsych scientific validation metrics are observational educational/research " +
  "fidelity measures. Competency and realism scores are not clinically validated " +
  "instruments. No statistical significance is claimed without a registered study protocol.";

export function buildPublicationSupport(input: {
  runs: ValidationRunResult[];
  dashboard?: ValidationDashboardSnapshot | null;
}): PublicationSupportPackage {
  const realism = input.runs.map((r) => r.realism.overall);
  const consistency = input.runs.map((r) => r.consistency.overall);
  const fidelity = input.runs.map((r) => r.metrics.clinical_fidelity);

  const methods = [
    "Design: observational post-hoc validation over sealed session observables (transcripts, clinical_snapshot flags, assessment scores, optional quality ledger metrics).",
    "Patient behaviour was not modified; validation never writes clinical_snapshot, case_memory, LTM, or DecisionPlan.",
    `Realism Engine scored ${21} clinical realism dimensions with fixed weights (Validation v${VALIDATION_VERSION}).`,
    "DSM/ICD Scenario Validator measured coding and timeline coherence only — diagnoses were never assigned.",
    "Inter-rater metrics (percent agreement, Cohen κ, ICC, weighted agreement) computed only when ≥2 raters and ≥5 paired cases; otherwise reported as null.",
    "Psychometric facets (α, face/content/construct/criterion/convergent/discriminant/known-groups) reported with significance_claimed=false.",
    "Benchmark comparisons used synthetic baseline, expert-authored, historical simulation, and gold-standard anchors — comparison only, no training.",
    `Algorithm version: ${VALIDATION_ALGORITHM_VERSION}.`,
  ];

  const results_tables = [
    {
      title: "Table 1. Validation run summary",
      columns: ["n", "realism_mean", "realism_sd", "consistency_mean", "fidelity_mean"],
      rows: [
        [
          input.runs.length,
          realism.length ? Math.round(mean(realism) * 10) / 10 : null,
          realism.length >= 2 ? Math.round(stddev(realism) * 10) / 10 : null,
          consistency.length ? Math.round(mean(consistency) * 10) / 10 : null,
          fidelity.length ? Math.round(mean(fidelity) * 10) / 10 : null,
        ],
      ],
    },
    {
      title: "Table 2. Quality metrics (means)",
      columns: [
        "realism_index",
        "consistency_index",
        "clinical_fidelity",
        "memory_integrity",
        "session_quality",
      ],
      rows: [
        input.runs.length
          ? [
              Math.round(mean(input.runs.map((r) => r.metrics.realism_index)) * 10) /
                10,
              Math.round(
                mean(input.runs.map((r) => r.metrics.consistency_index)) * 10,
              ) / 10,
              Math.round(
                mean(input.runs.map((r) => r.metrics.clinical_fidelity)) * 10,
              ) / 10,
              Math.round(
                mean(input.runs.map((r) => r.metrics.memory_integrity)) * 10,
              ) / 10,
              Math.round(
                mean(input.runs.map((r) => r.metrics.session_quality)) * 10,
              ) / 10,
            ]
          : [null, null, null, null, null],
      ],
    },
  ];

  const figure_specs = [
    {
      id: "fig-realism-trend",
      title: "Realism index over validation runs",
      chart: "trend" as const,
      series: [
        {
          label: "realism_index",
          values: input.runs.map((r) => r.metrics.realism_index),
        },
      ],
    },
    {
      id: "fig-ci",
      title: "Realism confidence intervals",
      chart: "ci" as const,
      series: [
        {
          label: "ci_lower",
          values: input.runs.map((r) => r.realism.confidence_interval.lower),
        },
        {
          label: "ci_upper",
          values: input.runs.map((r) => r.realism.confidence_interval.upper),
        },
      ],
    },
    {
      id: "fig-reliability",
      title: "Inter-rater kappa (when available)",
      chart: "reliability" as const,
      series: [
        {
          label: "cohen_kappa",
          values: input.runs.flatMap((r) =>
            r.reliability.inter_rater
              .filter((x) => x.cohen_kappa != null)
              .map((x) => x.cohen_kappa as number),
          ),
        },
      ],
    },
    {
      id: "fig-benchmark",
      title: "Benchmark deltas",
      chart: "benchmark" as const,
      series: [
        {
          label: "delta",
          values: input.runs.flatMap((r) =>
            r.benchmarks
              .map((b) => b.delta)
              .filter((x): x is number => x != null),
          ),
        },
      ],
    },
  ];

  const limitations = [
    "No external OSCE criterion study is published on this branch.",
    "Heuristic transcript cues are language-sensitive and incomplete.",
    "Empty expert-rating corpora yield null reliability coefficients.",
    "Longitudinal horizons beyond observed data are explicitly marked simulated.",
    "Educational assessment overall is not a validated clinical outcome.",
    DISCLAIMER,
  ];

  if (input.dashboard?.limitations.length) {
    limitations.push(...input.dashboard.limitations);
  }

  return {
    methods,
    results_tables,
    figure_specs,
    limitations,
    reproducibility_metadata: {
      validation_version: VALIDATION_VERSION,
      algorithm_version: VALIDATION_ALGORITHM_VERSION,
      n_runs: input.runs.length,
      observational: "true",
      patient_state_modified: "false",
    },
    statistical_summaries: [
      {
        label: "realism_overall",
        n: realism.length,
        mean: realism.length ? mean(realism) : null,
        sd: realism.length >= 2 ? stddev(realism) : null,
        ci: input.runs[0]?.realism.confidence_interval ?? null,
        significance_claimed: false,
      },
      {
        label: "consistency_overall",
        n: consistency.length,
        mean: consistency.length ? mean(consistency) : null,
        sd: consistency.length >= 2 ? stddev(consistency) : null,
        ci: null,
        significance_claimed: false,
      },
    ],
    disclaimer: DISCLAIMER,
  };
}
