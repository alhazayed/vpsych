import type { EducationOutcomeRow } from "@/lib/cvl/types";
import { ci95Mean, cohensD, mean } from "@/lib/cvl/statistics";

export function validateEducationOutcome(
  raw: unknown,
): { ok: true; row: EducationOutcomeRow } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<EducationOutcomeRow>;
  if (!body.study_id || !body.learner_token) {
    return { ok: false, error: "study_id and learner_token required" };
  }
  if (body.group !== "traditional" && body.group !== "vpsych") {
    return { ok: false, error: "group must be traditional|vpsych" };
  }
  return {
    ok: true,
    row: {
      study_id: body.study_id,
      learner_token: body.learner_token,
      group: body.group,
      osce: numOrNull(body.osce),
      mse: numOrNull(body.mse),
      dsm_diagnosis: numOrNull(body.dsm_diagnosis),
      icd_diagnosis: numOrNull(body.icd_diagnosis),
      risk_assessment: numOrNull(body.risk_assessment),
      empathy: numOrNull(body.empathy),
      documentation: numOrNull(body.documentation),
      retention: numOrNull(body.retention),
      supervisor_rating: numOrNull(body.supervisor_rating),
      time_to_competency_days: numOrNull(body.time_to_competency_days),
      recorded_at: body.recorded_at ?? new Date().toISOString(),
    },
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function analyzeEducationStudy(rows: EducationOutcomeRow[]): {
  n_traditional: number;
  n_vpsych: number;
  primary_osce: {
    traditional_mean: number | null;
    vpsych_mean: number | null;
    cohens_d: number | null;
    insufficient_data: boolean;
  };
  notes: string[];
} {
  const trad = rows.filter((r) => r.group === "traditional");
  const vps = rows.filter((r) => r.group === "vpsych");
  const tOsce = trad.map((r) => r.osce).filter((x): x is number => x != null);
  const vOsce = vps.map((r) => r.osce).filter((x): x is number => x != null);
  const insufficient = tOsce.length < 5 || vOsce.length < 5;
  return {
    n_traditional: trad.length,
    n_vpsych: vps.length,
    primary_osce: {
      traditional_mean: mean(tOsce),
      vpsych_mean: mean(vOsce),
      cohens_d: cohensD(vOsce, tOsce),
      insufficient_data: insufficient,
    },
    notes: [
      insufficient
        ? "Insufficient n for education primary endpoint (need ≥5 per arm with OSCE)."
        : `OSCE CI traditional=${JSON.stringify(ci95Mean(tOsce))}; vpsych=${JSON.stringify(ci95Mean(vOsce))}`,
      "No simulated outcomes — only submitted learner rows are analyzed.",
    ],
  };
}
