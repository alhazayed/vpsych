import type {
  BpcRatingSubmission,
  CflRecord,
  CvlAssignment,
  CvlMetricResult,
  CvlStudy,
  EducationOutcomeRow,
  HcfEvaluationRow,
} from "@/lib/cvl/types";
import { CVL_VERSION } from "@/lib/cvl/types";
import { scoreBpcComposite } from "@/lib/cvl/bpc";
import { analyzeEducationStudy } from "@/lib/cvl/education-study";
import { computeAllMetrics } from "@/lib/cvl/metrics";
import { icc2Approx } from "@/lib/cvl/statistics";

export type CvlExportBundle = {
  cvl_version: string;
  generated_at: string;
  is_fabricated: false;
  studies: CvlStudy[];
  metrics: CvlMetricResult[];
  cfl: CflRecord[];
  education_analysis: ReturnType<typeof analyzeEducationStudy>;
  inter_rater: {
    icc: number | null;
    insufficient_data: boolean;
    note: string;
  };
  redacted_ratings_count: number;
};

/** Redacted research package — no reviewer identity, arms optional. */
export function buildCvlResearchPackage(input: {
  studies: CvlStudy[];
  assignments: CvlAssignment[];
  bpc: BpcRatingSubmission[];
  hcf: HcfEvaluationRow[];
  education: EducationOutcomeRow[];
  longitudinal: Parameters<typeof computeAllMetrics>[0]["longitudinal"];
  cfl: CflRecord[];
  include_arms?: boolean;
}): CvlExportBundle {
  const metrics = computeAllMetrics({
    bpc: input.bpc,
    assignments: input.assignments,
    hcf: input.hcf,
    education: input.education,
    longitudinal: input.longitudinal,
  });

  // Build item×rater matrix of composites when multiple raters share case_ref
  const byCase = new Map<string, number[]>();
  const armByAssignment = new Map(
    input.assignments.map((a) => [a.id, a]),
  );
  for (const r of input.bpc) {
    const a = armByAssignment.get(r.assignment_id);
    const key = a?.case_ref ?? r.assignment_id;
    const list = byCase.get(key) ?? [];
    list.push(scoreBpcComposite(r.ratings));
    byCase.set(key, list);
  }
  const matrix = [...byCase.values()].filter((row) => row.length >= 2);
  // pad unequal — skip ICC if ragged
  const minK = matrix.length
    ? Math.min(...matrix.map((r) => r.length))
    : 0;
  const square =
    minK >= 2 ? matrix.map((r) => r.slice(0, minK)) : [];
  const icc = square.length >= 2 ? icc2Approx(square) : null;

  return {
    cvl_version: CVL_VERSION,
    generated_at: new Date().toISOString(),
    is_fabricated: false,
    studies: input.studies,
    metrics,
    cfl: input.cfl,
    education_analysis: analyzeEducationStudy(input.education),
    inter_rater: {
      icc,
      insufficient_data: icc == null,
      note:
        icc == null
          ? "ICC requires ≥2 cases with ≥2 raters each — no fabricated reliability."
          : "ICC(2,1) approximation on BPC composites (redacted).",
    },
    redacted_ratings_count: input.bpc.length + input.hcf.length,
  };
}

export function bpcToCsv(
  bpc: BpcRatingSubmission[],
  assignments: CvlAssignment[],
  opts?: { include_arms?: boolean },
): string {
  const armById = new Map(assignments.map((a) => [a.id, a]));
  const header = [
    "assignment_id",
    "study_id",
    "reviewer_type",
    "modality",
    ...(opts?.include_arms ? ["arm"] : []),
    "composite",
    "clinical_realism",
    "emotional_realism",
    "diagnostic_consistency",
    "speech_naturalness",
    "educational_usefulness",
    "would_teach",
    "believed_arm",
    "confidence_pct",
    "rated_at",
  ];
  const lines = [header.join(",")];
  for (const r of bpc) {
    const a = armById.get(r.assignment_id);
    const row = [
      r.assignment_id,
      r.study_id,
      r.reviewer_type,
      r.modality,
      ...(opts?.include_arms ? [a?.arm ?? ""] : []),
      String(scoreBpcComposite(r.ratings)),
      String(r.ratings.clinical_realism),
      String(r.ratings.emotional_realism),
      String(r.ratings.diagnostic_consistency),
      String(r.ratings.speech_naturalness),
      String(r.ratings.educational_usefulness),
      String(r.would_teach_with_case ?? ""),
      String(r.believed_arm ?? ""),
      String(r.confidence_pct),
      r.rated_at,
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** SPSS-friendly variable dictionary (syntax stub — no fake cases). */
export function spssDictionary(): string {
  return [
    "* VPsych CVL export — SPSS variable dictionary.",
    "* Import CSV then apply.",
    "VARIABLE LABELS",
    " clinical_realism 'BPC clinical realism (1-5)'",
    " /emotional_realism 'BPC emotional realism (1-5)'",
    " /composite 'Weighted BPC composite 0-100'",
    " /confidence_pct 'Arm belief confidence 0-100'.",
    "VALUE LABELS clinical_realism emotional_realism",
    " 1 'Very poor' 2 'Poor' 3 'Fair' 4 'Good' 5 'Excellent'.",
  ].join("\n");
}

export function rAnalysisStub(): string {
  return [
    "# VPsych CVL — R analysis stub (real CSV required)",
    "df <- read.csv('cvl-bpc.csv', stringsAsFactors = FALSE)",
    "summary(df$composite)",
    "# psych::ICC after reshaping multi-rater data",
    "# Do not impute missing arms or fabricate rows.",
  ].join("\n");
}

export function pythonAnalysisStub(): string {
  return [
    "# VPsych CVL — Python analysis stub (real CSV required)",
    "import pandas as pd",
    "df = pd.read_csv('cvl-bpc.csv')",
    "print(df['composite'].describe())",
    "# Use pingouin.intraclass_corr for ICC — never synthesize ratings.",
  ].join("\n");
}
