/**
 * Offline demo corpus spanning all three ledger layers.
 */

import {
  buildEducationalEvent,
} from "@/lib/ledgers/education";
import {
  buildOperationalEvent,
} from "@/lib/ledgers/operational";
import {
  appendCorrelationMemory,
  appendEducationalMemory,
  appendOperationalMemory,
  clearMultiLedgerMemoryForTests,
  listCorrelationsMemory,
  listEducationalMemory,
  listOperationalMemory,
  multiLedgerMemoryCounts,
} from "@/lib/ledgers/store";
import { buildCorrelation, newCorrelationId } from "@/lib/ledgers/shared";
import { buildQualityLedgerOfflineCorpus } from "@/lib/quality-ledger";

export function seedMultiLedgerOfflineCorpus(): {
  operational: ReturnType<typeof listOperationalMemory>;
  educational: ReturnType<typeof listEducationalMemory>;
  correlations: ReturnType<typeof listCorrelationsMemory>;
  quality: ReturnType<typeof buildQualityLedgerOfflineCorpus>;
} {
  const counts = multiLedgerMemoryCounts();
  if (counts.operational < 3) {
    if (counts.operational === 0 && counts.educational === 0) {
      clearMultiLedgerMemoryForTests();
    }
    const corr = newCorrelationId();
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const learnerId = "00000000-0000-4000-8001-000000000001";

    const opAuth = buildOperationalEvent({
      event_type: "auth.session_check",
      category: "auth",
      outcome: "success",
      actor_id: learnerId,
      correlation_id: corr,
      resource_type: "session",
      resource_id: sessionId,
    });
    const opApi = buildOperationalEvent({
      event_type: "api.sessions.start",
      category: "api",
      outcome: "success",
      actor_id: learnerId,
      correlation_id: corr,
      resource_type: "session",
      resource_id: sessionId,
      latency_ms: 42,
    });
    const opDenied = buildOperationalEvent({
      event_type: "admin.access",
      category: "authorization",
      severity: "warning",
      outcome: "denied",
      actor_id: learnerId,
      resource_type: "api",
      resource_id: "/api/admin/ledgers",
    });

    try {
      appendOperationalMemory(opAuth);
      appendOperationalMemory(opApi);
      appendOperationalMemory(opDenied);
    } catch {
      /* seeded */
    }

    const eduStart = buildEducationalEvent({
      event_type: "assessment_started",
      correlation_id: corr,
      learner_id: learnerId,
      session_id: sessionId,
      diagnosis_slug: "major-depressive-disorder",
      difficulty: "intermediate",
      language: "en",
      locale: "en-US",
      outcome: "started",
    });
    const eduDone = buildEducationalEvent({
      event_type: "assessment_completed",
      correlation_id: corr,
      learner_id: learnerId,
      session_id: sessionId,
      diagnosis_slug: "major-depressive-disorder",
      difficulty: "intermediate",
      duration_sec: 1200,
      language: "en",
      locale: "en-US",
      outcome: "completed",
      competencies_before: { mean: 60 },
      competencies_after: { mean: 68 },
      adaptive_decision: { next: "increase_difficulty" },
    });
    const eduAdapt = buildEducationalEvent({
      event_type: "adaptive_decision",
      correlation_id: corr,
      learner_id: learnerId,
      session_id: sessionId,
      adaptive_decision: { next_case: "gad-intermediate" },
      outcome: "recommended",
    });

    try {
      appendEducationalMemory(eduStart);
      appendEducationalMemory(eduDone);
      appendEducationalMemory(eduAdapt);
    } catch {
      /* seeded */
    }

    appendCorrelationMemory(
      buildCorrelation(
        {
          session_id: sessionId,
          learner_id: learnerId,
          assessment_id: sessionId,
          operational_event_id: opApi.id,
          educational_event_id: eduDone.id,
        },
        corr,
      ),
    );
  }

  const quality = buildQualityLedgerOfflineCorpus();
  return {
    operational: listOperationalMemory(),
    educational: listEducationalMemory(),
    correlations: listCorrelationsMemory(),
    quality,
  };
}
