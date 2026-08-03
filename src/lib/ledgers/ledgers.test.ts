/**
 * Enterprise Multi-Ledger Platform — unit suite.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  MULTI_LEDGER_VERSION,
  buildEducationalEvent,
  buildMultiLedgerDashboard,
  buildOperationalEvent,
  clearMultiLedgerMemoryForTests,
  exportAnonymousMultiLedger,
  exportMultiLedgerCsv,
  exportMultiLedgerJson,
  listEducationalMemory,
  listOperationalMemory,
  newCorrelationId,
  recordCorrelation,
  recordEducationalEvent,
  recordOperationalEvent,
  replaySessionTimeline,
  sealContent,
  seedMultiLedgerOfflineCorpus,
  sealSessionCompleteLedgers,
  sealSessionStartLedgers,
} from "@/lib/ledgers";

describe("shared integrity", () => {
  it("seals deterministically and versions platform", () => {
    expect(MULTI_LEDGER_VERSION).toBe("1.0.0");
    expect(sealContent({ a: 1, b: 2 })).toBe(sealContent({ b: 2, a: 1 }));
    expect(newCorrelationId().startsWith("corr_")).toBe(true);
  });
});

describe("operational + educational builders", () => {
  it("builds immutable operational events with hash", () => {
    const e = buildOperationalEvent({
      event_type: "api.sessions.start",
      category: "api",
      outcome: "success",
      resource_type: "session",
      resource_id: "s1",
    });
    expect(e.content_hash).toHaveLength(64);
    expect(e.schema_version).toBe("1.0.0");
    expect(e.event_id.startsWith("op_")).toBe(true);
  });

  it("builds educational assessment lifecycle events", () => {
    const e = buildEducationalEvent({
      event_type: "assessment_completed",
      learner_id: "l1",
      session_id: "s1",
      diagnosis_slug: "mdd",
      duration_sec: 900,
      outcome: "completed",
      competencies_before: { mean: 50 },
      competencies_after: { mean: 60 },
    });
    expect(e.event_id.startsWith("edu_")).toBe(true);
    expect(e.content_hash).toHaveLength(64);
    expect(e.competencies_after.mean).toBe(60);
  });
});

describe("memory persist + session bridge", () => {
  beforeEach(() => {
    clearMultiLedgerMemoryForTests();
  });

  it("persists to memory without supabase", async () => {
    const op = await recordOperationalEvent(null, {
      event_type: "security.test",
      category: "security",
      outcome: "success",
    });
    expect(op.ok).toBe(true);
    expect(op.persisted).toBe("memory");
    const edu = await recordEducationalEvent(null, {
      event_type: "learning_milestone",
      learner_id: "l1",
      outcome: "achieved",
    });
    expect(edu.ok).toBe(true);
    const corr = await recordCorrelation(null, {
      session_id: "s1",
      learner_id: "l1",
      operational_event_id: op.event.id,
      educational_event_id: edu.event.id,
    });
    expect(corr.ok).toBe(true);
    expect(listOperationalMemory()).toHaveLength(1);
    expect(listEducationalMemory()).toHaveLength(1);
  });

  it("seals session start and complete across layers", async () => {
    const start = await sealSessionStartLedgers(null, {
      sessionId: "00000000-0000-4000-8000-000000000010",
      learnerId: "00000000-0000-4000-8001-000000000010",
      diagnosisSlug: "major-depressive-disorder",
      difficulty: "intermediate",
      templateId: "tmpl-1",
      language: "en",
      locale: "en-US",
    });
    expect(start.correlationId.startsWith("corr_")).toBe(true);

    await sealSessionCompleteLedgers(null, {
      sessionId: "00000000-0000-4000-8000-000000000010",
      learnerId: "00000000-0000-4000-8001-000000000010",
      correlationId: start.correlationId,
      durationSec: 1000,
      scientificLedgerId: "ql-1",
      overallScore: 82,
      adaptiveDecision: { next: "case-b" },
      competenciesAfter: { mean: 70 },
      fallbackUsed: false,
    });

    expect(listOperationalMemory().length).toBeGreaterThanOrEqual(2);
    expect(listEducationalMemory().length).toBeGreaterThanOrEqual(3);
  });
});

describe("dashboard + replay + exports", () => {
  beforeEach(() => {
    clearMultiLedgerMemoryForTests();
  });

  it("seeds corpus and builds dashboard with replay", () => {
    const seeded = seedMultiLedgerOfflineCorpus();
    expect(seeded.operational.length).toBeGreaterThanOrEqual(3);
    expect(seeded.educational.length).toBeGreaterThanOrEqual(3);
    expect(seeded.quality.length).toBeGreaterThanOrEqual(1);

    const dash = buildMultiLedgerDashboard(seeded);
    expect(dash.platform_version).toBe("1.0.0");
    expect(dash.layers.operational.n).toBe(seeded.operational.length);
    expect(dash.layers.education.n).toBe(seeded.educational.length);
    expect(dash.layers.quality.n).toBe(seeded.quality.length);

    const timeline = replaySessionTimeline({
      session_id: "00000000-0000-4000-8000-000000000001",
      ...seeded,
    });
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.some((p) => p.layer === "education")).toBe(true);

    const csv = exportMultiLedgerCsv(seeded);
    expect(csv.split("\n")[0]).toContain("layer");
    const json = JSON.parse(exportMultiLedgerJson(seeded));
    expect(json.format).toBe("vpsych-multi-ledger-export");
    const anon = JSON.parse(
      exportAnonymousMultiLedger(seeded.educational, seeded.quality),
    );
    expect(anon.phi_stripped).toBe(true);
  });
});
