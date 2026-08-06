import { randomUUID } from "crypto";
import type {
  ClinicalFidelityLevel,
  CflRecord,
  CvlMetricResult,
} from "@/lib/cvl/types";
import { CFL_DEFINITIONS } from "@/lib/cvl/types";

/**
 * Derive Clinical Fidelity Level from observed metrics.
 * Never invents data — returns CFL-1 with insufficient_data rationale when empty.
 */
export function deriveClinicalFidelityLevel(input: {
  case_ref: string;
  disorder_slug?: string | null;
  metrics: CvlMetricResult[];
  has_blind_transcript_pass?: boolean;
  has_blind_live_pass?: boolean;
  sp_noninferior?: boolean | null;
}): CflRecord {
  const byId = new Map(input.metrics.map((m) => [m.metric_id, m]));
  const cri = byId.get("CRI");
  const hcfi = byId.get("HCFI");
  const eei = byId.get("EEI");
  const rationale: string[] = [];
  const evidence_refs = input.metrics.flatMap((m) => m.evidence_refs);

  const anyData = input.metrics.some((m) => !m.insufficient_data && m.score != null);
  if (!anyData) {
    return {
      id: randomUUID(),
      case_ref: input.case_ref,
      disorder_slug: input.disorder_slug ?? null,
      level: "CFL-1",
      rationale: [
        "Insufficient human validation data — default CFL-1 (technically coherent only).",
        "No fabricated scores. Collect BPC/HCF ratings to advance.",
      ],
      evidence_refs: [],
      metrics: Object.fromEntries(
        input.metrics.map((m) => [m.metric_id, m.score]),
      ),
      computed_at: new Date().toISOString(),
      ledger_ref: null,
      human_approved: false,
    };
  }

  let level: ClinicalFidelityLevel = "CFL-1";
  rationale.push(CFL_DEFINITIONS["CFL-1"]);

  const criOk = (cri?.score ?? 0) >= 60 && !cri?.insufficient_data;
  const hcfiOk = (hcfi?.score ?? 0) >= 60 && !hcfi?.insufficient_data;
  if (criOk || hcfiOk) {
    level = "CFL-2";
    rationale.push("Student-believable threshold met (CRI/HCFI ≥ 60).");
  }

  if (
    level === "CFL-2" &&
    (cri?.score ?? 0) >= 70 &&
    input.has_blind_transcript_pass
  ) {
    level = "CFL-3";
    rationale.push("Psychiatrist transcript-blind threshold met (CRI ≥ 70).");
  }

  if (level === "CFL-3" && input.has_blind_live_pass) {
    level = "CFL-4";
    rationale.push("Blinded live interaction pass recorded.");
  }

  if (
    level === "CFL-4" &&
    input.sp_noninferior === true &&
    (eei?.score ?? 0) >= 70 &&
    !eei?.insufficient_data
  ) {
    level = "CFL-5";
    rationale.push(
      "Non-inferior to standardized patients with educational effectiveness ≥ 70.",
    );
  }

  rationale.push(`Assigned ${level}: ${CFL_DEFINITIONS[level]}`);

  return {
    id: randomUUID(),
    case_ref: input.case_ref,
    disorder_slug: input.disorder_slug ?? null,
    level,
    rationale,
    evidence_refs,
    metrics: Object.fromEntries(
      input.metrics.map((m) => [m.metric_id, m.score]),
    ),
    computed_at: new Date().toISOString(),
    ledger_ref: null,
    human_approved: false,
  };
}
