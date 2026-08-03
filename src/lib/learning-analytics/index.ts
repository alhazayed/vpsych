/**
 * Learning Analytics — cohort metrics, risk detection, benchmarking, exports.
 */

import type { LearnerProfile, PerformanceAnalytics } from "@/lib/ace/types";
import { buildAnalytics } from "@/lib/ace/analytics";
import { COMPETENCY_IDS } from "@/lib/ace/catalog";

export type RiskLearner = {
  learner_id: string;
  user_id: string;
  profession: string;
  institution: string | null;
  confidence_score: number;
  learning_velocity: number;
  completed_case_count: number;
  risk_score: number;
  risk_reasons: string[];
};

export type InstitutionBenchmark = {
  institution: string;
  learner_count: number;
  mean_confidence: number;
  mean_velocity: number;
  mean_cases: number;
  at_risk_count: number;
};

export type InstructorBenchmark = {
  /** Therapist/instructor user id when attributable; else "unassigned". */
  instructor_id: string;
  learner_count: number;
  mean_confidence: number;
  mean_velocity: number;
  mean_cases: number;
};

export type CohortAnalytics = {
  generated_at: string;
  learner_count: number;
  mean_confidence: number;
  mean_velocity: number;
  mean_cases: number;
  mastery_ready_count: number;
  risk_learners: RiskLearner[];
  institutions: InstitutionBenchmark[];
  instructors: InstructorBenchmark[];
  competency_benchmarks: Array<{
    competency_id: string;
    mean_score: number;
    assessed_learners: number;
  }>;
  longitudinal: Array<{
    learner_id: string;
    history_overall: number[];
    trend_slope: number;
  }>;
};

export type LearnerRow = {
  id: string;
  user_id: string;
  profession: string;
  training_level: string;
  institution: string | null;
  completed_case_count: number;
  confidence_score: number;
  learning_velocity: number;
  certification_status: string;
  competencies?: Array<{
    competency_id: string;
    score: number;
    samples: number;
  }>;
  metadata?: Record<string, unknown>;
  /** Optional instructor assignment from metadata or sessions. */
  instructor_id?: string | null;
};

/** True arithmetic mean for multi-hit rubric merges. */
export function meanMerge(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Linear slope of overall history (simple OLS on index). */
export function trendSlope(history: number[]): number {
  if (history.length < 2) return 0;
  const n = history.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += history[i]!;
    sumXY += i * history[i]!;
    sumXX += i * i;
  }
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return 0;
  return Math.round(((n * sumXY - sumX * sumY) / den) * 1000) / 1000;
}

export function classifyRiskLearner(row: LearnerRow): RiskLearner | null {
  const reasons: string[] = [];
  let risk = 0;
  const history = (row.metadata?.history_overall as number[]) ?? [];
  const slope = trendSlope(history);

  if (row.confidence_score < 45) {
    reasons.push("low_confidence");
    risk += 30;
  }
  if (row.learning_velocity < 0) {
    reasons.push("negative_velocity");
    risk += 25;
  }
  if (row.completed_case_count >= 3 && slope < -1) {
    reasons.push("declining_assessment_trend");
    risk += 25;
  }
  const weakAssessed = (row.competencies ?? []).filter(
    (c) => c.samples > 0 && c.score < 55,
  );
  if (weakAssessed.length >= 3) {
    reasons.push("multiple_weak_competencies");
    risk += 20;
  }
  if (row.completed_case_count >= 5 && row.confidence_score < 55) {
    reasons.push("stalled_progress");
    risk += 15;
  }

  if (risk < 30) return null;
  return {
    learner_id: row.id,
    user_id: row.user_id,
    profession: row.profession,
    institution: row.institution,
    confidence_score: row.confidence_score,
    learning_velocity: row.learning_velocity,
    completed_case_count: row.completed_case_count,
    risk_score: Math.min(100, risk),
    risk_reasons: reasons,
  };
}

export function buildCohortAnalytics(rows: LearnerRow[]): CohortAnalytics {
  const n = rows.length || 1;
  const mean = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;

  const risk_learners = rows
    .map(classifyRiskLearner)
    .filter((r): r is RiskLearner => Boolean(r))
    .sort((a, b) => b.risk_score - a.risk_score);

  const byInst = new Map<string, LearnerRow[]>();
  for (const r of rows) {
    const key = r.institution?.trim() || "unspecified";
    const list = byInst.get(key) ?? [];
    list.push(r);
    byInst.set(key, list);
  }
  const institutions: InstitutionBenchmark[] = [...byInst.entries()].map(
    ([institution, list]) => ({
      institution,
      learner_count: list.length,
      mean_confidence: mean(list.map((l) => l.confidence_score)),
      mean_velocity: mean(list.map((l) => l.learning_velocity)),
      mean_cases: mean(list.map((l) => l.completed_case_count)),
      at_risk_count: list.filter((l) => classifyRiskLearner(l)).length,
    }),
  );

  const byInstructor = new Map<string, LearnerRow[]>();
  for (const r of rows) {
    const key = r.instructor_id?.trim() || "unassigned";
    const list = byInstructor.get(key) ?? [];
    list.push(r);
    byInstructor.set(key, list);
  }
  const instructors: InstructorBenchmark[] = [...byInstructor.entries()].map(
    ([instructor_id, list]) => ({
      instructor_id,
      learner_count: list.length,
      mean_confidence: mean(list.map((l) => l.confidence_score)),
      mean_velocity: mean(list.map((l) => l.learning_velocity)),
      mean_cases: mean(list.map((l) => l.completed_case_count)),
    }),
  );

  const competency_benchmarks = COMPETENCY_IDS.map((id) => {
    const assessed = rows.flatMap((r) =>
      (r.competencies ?? []).filter(
        (c) => c.competency_id === id && c.samples > 0,
      ),
    );
    return {
      competency_id: id,
      mean_score: mean(assessed.map((c) => c.score)),
      assessed_learners: assessed.length,
    };
  });

  const longitudinal = rows.map((r) => {
    const history = (r.metadata?.history_overall as number[]) ?? [];
    return {
      learner_id: r.id,
      history_overall: history,
      trend_slope: trendSlope(history),
    };
  });

  const mastery_ready_count = rows.filter((r) => {
    const assessed = (r.competencies ?? []).filter((c) => c.samples >= 3);
    return (
      assessed.length >= 5 &&
      assessed.every((c) => c.score >= 70) &&
      r.confidence_score >= 60
    );
  }).length;

  return {
    generated_at: new Date().toISOString(),
    learner_count: rows.length,
    mean_confidence: mean(rows.map((r) => r.confidence_score)),
    mean_velocity: mean(rows.map((r) => r.learning_velocity)),
    mean_cases: mean(rows.map((r) => r.completed_case_count)),
    mastery_ready_count,
    risk_learners,
    institutions: institutions.sort((a, b) => b.learner_count - a.learner_count),
    instructors: instructors.sort((a, b) => b.learner_count - a.learner_count),
    competency_benchmarks,
    longitudinal,
  };
}

export function analyticsForProfile(profile: LearnerProfile): PerformanceAnalytics {
  const history = (profile.metadata?.history_overall as number[]) ?? [];
  const completed = (profile.metadata?.completed_diagnoses as string[]) ?? [];
  const missed = (profile.metadata?.missed_diagnoses as string[]) ?? [];
  return buildAnalytics(profile, history, completed, missed);
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function cohortToCsv(cohort: CohortAnalytics): string {
  const lines: string[] = [];
  lines.push("section,key,value");
  lines.push(`summary,learner_count,${cohort.learner_count}`);
  lines.push(`summary,mean_confidence,${cohort.mean_confidence}`);
  lines.push(`summary,mean_velocity,${cohort.mean_velocity}`);
  lines.push(`summary,mean_cases,${cohort.mean_cases}`);
  lines.push(`summary,mastery_ready_count,${cohort.mastery_ready_count}`);
  lines.push(`summary,at_risk_count,${cohort.risk_learners.length}`);
  for (const r of cohort.risk_learners) {
    lines.push(
      [
        "risk_learner",
        r.learner_id,
        csvEscape(
          `${r.risk_score}|${r.risk_reasons.join(";")}|conf=${r.confidence_score}|vel=${r.learning_velocity}`,
        ),
      ].join(","),
    );
  }
  for (const i of cohort.institutions) {
    lines.push(
      [
        "institution",
        csvEscape(i.institution),
        csvEscape(
          `n=${i.learner_count};conf=${i.mean_confidence};vel=${i.mean_velocity};risk=${i.at_risk_count}`,
        ),
      ].join(","),
    );
  }
  for (const i of cohort.instructors) {
    lines.push(
      [
        "instructor",
        csvEscape(i.instructor_id),
        csvEscape(
          `n=${i.learner_count};conf=${i.mean_confidence};vel=${i.mean_velocity}`,
        ),
      ].join(","),
    );
  }
  for (const c of cohort.competency_benchmarks) {
    lines.push(
      `competency,${c.competency_id},${c.mean_score}|assessed=${c.assessed_learners}`,
    );
  }
  return lines.join("\n");
}

/** Excel-friendly CSV (UTF-8 BOM). */
export function cohortToExcelCsv(cohort: CohortAnalytics): string {
  return `\uFEFF${cohortToCsv(cohort)}`;
}

export function cohortToResearchDataset(cohort: CohortAnalytics): {
  schema_version: string;
  generated_at: string;
  description: string;
  cohort: Omit<CohortAnalytics, "risk_learners"> & {
    risk_learners: Array<Omit<RiskLearner, "user_id">>;
  };
} {
  return {
    schema_version: "vpsych-learning-analytics-1.0",
    generated_at: cohort.generated_at,
    description:
      "De-identified cohort learning analytics for research export (opaque learner UUIDs only; auth user_ids stripped).",
    cohort: {
      ...cohort,
      risk_learners: cohort.risk_learners.map(
        ({ user_id: _uid, ...rest }) => rest,
      ),
    },
  };
}

/** Minimal single-page PDF (text only) for accreditation exports. */
export function cohortToPdf(cohort: CohortAnalytics): Uint8Array {
  const lines = [
    "VPsych Learning Analytics Report",
    `Generated: ${cohort.generated_at}`,
    `Learners: ${cohort.learner_count}`,
    `Mean confidence: ${cohort.mean_confidence}`,
    `Mean velocity: ${cohort.mean_velocity}`,
    `Mean cases: ${cohort.mean_cases}`,
    `Mastery-ready: ${cohort.mastery_ready_count}`,
    `At-risk learners: ${cohort.risk_learners.length}`,
    "",
    "Institutions:",
    ...cohort.institutions.map(
      (i) =>
        `- ${i.institution}: n=${i.learner_count} conf=${i.mean_confidence} risk=${i.at_risk_count}`,
    ),
    "",
    "Risk learners:",
    ...cohort.risk_learners.slice(0, 20).map(
      (r) =>
        `- ${r.learner_id}: score=${r.risk_score} (${r.risk_reasons.join(", ")})`,
    ),
  ];
  const content = lines.map((l, i) => `BT /F1 10 Tf 40 ${750 - i * 14} Td (${escapePdf(l)}) Tj ET`).join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj",
  );
  objects.push(
    `4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream endobj`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj + "\n";
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
