/**
 * Offline corpus for admin dashboards when DB/memory empty.
 */

import { runValidationPipeline } from "@/lib/validation/engine";
import { simulateLongitudinalCorpus } from "@/lib/validation/longitudinal";
import type { ExpertRating, ValidationRunResult } from "@/lib/validation/types";

export function buildValidationOfflineCorpus(): ValidationRunResult[] {
  const sessions = simulateLongitudinalCorpus(25, "offline-corpus-v1");
  const runs: ValidationRunResult[] = [];
  for (let i = 0; i < Math.min(12, sessions.length); i++) {
    runs.push(
      runValidationPipeline({
        session: sessions[i]!,
        sessionsForPsychometrics: sessions.slice(0, i + 1),
        ratings: [],
        studyId: "offline_corpus",
        seed: `offline:${i}`,
      }),
    );
  }
  return runs;
}

export function buildExpertRatingOfflineCorpus(): ExpertRating[] {
  const now = new Date().toISOString();
  const out: ExpertRating[] = [];
  const domains = [
    "overall_realism",
    "diagnostic_agreement",
    "risk_agreement",
    "communication_agreement",
  ] as const;
  for (let caseIdx = 0; caseIdx < 6; caseIdx++) {
    for (const rater of ["rater_a", "rater_b"]) {
      for (const domain of domains) {
        out.push({
          id: `off_${rater}_${domain}_${caseIdx}`,
          rater_id: rater,
          session_id: null,
          case_key: `case_${caseIdx}`,
          domain,
          score: 60 + ((caseIdx * 7 + domain.length + rater.length) % 30),
          scale_max: 100,
          notes: null,
          rated_at: now,
          study_id: "offline_corpus",
        });
      }
    }
  }
  return out;
}
