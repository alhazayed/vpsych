/**
 * Bridge session assessment output → Clinical Educator report.
 */

import type { ScoreEntry, SessionMessage } from "@/lib/types";
import { buildClinicalEducatorReport } from "@/lib/clinical-educator/engine";
import type { ClinicalEducatorReport } from "@/lib/clinical-educator/types";

export function clinicalEducatorFromAssessment(opts: {
  items: ScoreEntry[];
  messages: Pick<SessionMessage, "role" | "content">[];
  language: "en" | "ar";
  narrative: string;
  excerpts: string[];
  assessment_mode: "llm_examiner" | "heuristic_fallback";
}): ClinicalEducatorReport {
  return buildClinicalEducatorReport(opts);
}
