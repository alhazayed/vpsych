/**
 * Quality Ledger Engine v1.0 — unit & integration suite.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  QUALITY_LEDGER_VERSION,
  appendCorrectionLedger,
  appendQualityLedgerMemory,
  buildLedgerFromAssessment,
  buildQualityLedgerDashboard,
  buildQualityLedgerEntry,
  buildQualityLedgerOfflineCorpus,
  buildTimeline,
  clearQualityLedgerMemoryForTests,
  exportAnonymousResearchDataset,
  exportFhirCompatibleBundle,
  exportLedgerCsv,
  exportLedgerJson,
  getQualityLedgerBySession,
  hashPayload,
  listQualityLedgers,
  persistQualityLedger,
  sha256Hex,
} from "@/lib/quality-ledger";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import type { SessionAssessment } from "@/lib/ai/assessment";

const persona: PersonaRow = {
  id: "p-ql-test",
  avatar_id: "a-ql",
  slug: "ql-test",
  display_name: "QL Test",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

function assessment(overall = 80): SessionAssessment {
  return {
    language: "en",
    scores: {
      overall,
      items: [
        {
          id: "empathy",
          label: "Empathy",
          score: 4,
          max: 5,
          weight: 1,
          feedback: "Good rapport demonstrated in session.",
        },
        {
          id: "risk",
          label: "Risk",
          score: 4,
          max: 5,
          weight: 1,
          feedback: "Safety assessment completed thoroughly.",
        },
      ],
    },
    narrative: "Training assessment narrative for ledger tests.",
    excerpts: ["Mood explored.", "Sleep discussed."],
    aiSource: "gpt",
    model: "gpt-test",
  };
}

describe("Quality Ledger hashing", () => {
  it("is deterministic for stable payloads", () => {
    expect(sha256Hex("abc")).toHaveLength(64);
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });
});

describe("buildQualityLedgerEntry", () => {
  it("seals metrics, confidence, content hash, and versions", () => {
    const entry = buildQualityLedgerEntry({
      session_id: "sess-1",
      learner_id: "learn-1",
      diagnosis_slug: "major-depressive-disorder",
      language: "en",
      metrics: {
        cfi: { overall: 88, version: "1.0.0", ci: { lower: 80, upper: 95 } },
        eri: { overall: 82, version: "1.0.0", ci: { lower: 75, upper: 90 } },
        avi: { overall: 78, version: "1.0.0", ci: { lower: 70, upper: 86 } },
        ale: { overall: 74, version: "1.0.0" },
        rrs: { overall: 70, version: "1.0.0" },
        vqi: {
          overall: 80.5,
          version: "1.0.0",
          ci: { lower: 72, upper: 88 },
          confidence: {
            overall: 80,
            scientific: 80,
            clinical: 82,
            educational: 80,
            technical: 75,
            institutional: 70,
            research: 70,
          },
          reasoning: "Test VQI interpretation",
        },
      },
    });
    expect(entry.content_hash).toHaveLength(64);
    expect(entry.scores.map((s) => s.metric_id).sort()).toEqual([
      "ALE",
      "AVI",
      "CFI",
      "ERI",
      "RRS",
      "VQI",
    ]);
    expect(entry.vqi).toBe(80.5);
    expect(entry.quality_algorithm_version).toBeTruthy();
    expect(entry.supabase_migration_version).toBeTruthy();
    expect(entry.weight_matrix.length).toBeGreaterThanOrEqual(5);
    expect(entry.reasoning_summary).toContain("VQI");
    expect(QUALITY_LEDGER_VERSION).toBe("1.0.0");
  });
});

describe("immutable memory store", () => {
  beforeEach(() => {
    clearQualityLedgerMemoryForTests();
  });

  it("appends once per session and rejects duplicates", () => {
    const entry = buildQualityLedgerEntry({
      session_id: "s-dup",
      learner_id: "l1",
      metrics: { vqi: { overall: 70 } },
    });
    appendQualityLedgerMemory(entry);
    expect(getQualityLedgerBySession("s-dup")?.id).toBe(entry.id);
    expect(() => appendQualityLedgerMemory(entry)).toThrow(/immutable|already/);
    expect(() =>
      appendQualityLedgerMemory(
        buildQualityLedgerEntry({
          session_id: "s-dup",
          learner_id: "l1",
          metrics: { vqi: { overall: 71 } },
        }),
      ),
    ).toThrow(/already exists for session/);
  });

  it("corrections create a new linked version", async () => {
    const first = buildQualityLedgerEntry({
      session_id: "s-corr",
      learner_id: "l1",
      metrics: { vqi: { overall: 70 }, cfi: { overall: 70 } },
    });
    appendQualityLedgerMemory(first);
    const corr = await appendCorrectionLedger(null, first, {
      supersedes_reason: "metric algorithm update",
      metrics: { vqi: { overall: 72 }, cfi: { overall: 71 } },
    });
    expect(corr.ok).toBe(true);
    expect(corr.ledger.previous_ledger_id).toBe(first.id);
    expect(corr.ledger.event_type).toBe("correction");
    expect(listQualityLedgers()).toHaveLength(2);
  });
});

describe("buildLedgerFromAssessment", () => {
  beforeEach(() => {
    clearQualityLedgerMemoryForTests();
  });

  it("computes CFI–VQI and snapshots from a case assessment", () => {
    const disorder = BUILTIN_DISORDERS[0]!;
    const gen = generateCaseInstance({
      persona,
      avatarId: "a-ql",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "ql-unit-1",
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const entry = buildLedgerFromAssessment({
      sessionId: "00000000-0000-4000-8000-000000000099",
      learnerId: "00000000-0000-4000-8001-000000000099",
      assessment: assessment(84),
      clinicalSnapshot: gen.snapshot,
      durationSec: 1200,
      messages: [
        { role: "user", content: "How is your mood?" },
        { role: "assistant", content: "Low most days." },
      ],
      language: "en",
      locale: "en-US",
      competencyBefore: { mean: 60 },
      competencyAfter: { mean: 68, mastery: 0.5 },
    });

    expect(entry.event_type).toBe("assessment_completed");
    expect(entry.cfi).toBeGreaterThan(0);
    expect(entry.eri).toBeGreaterThan(0);
    expect(entry.avi).toBeGreaterThan(0);
    expect(entry.ale).toBeGreaterThan(0);
    expect(entry.rrs).toBeGreaterThan(0);
    expect(entry.vqi).toBeGreaterThan(0);
    expect(entry.snapshots.length).toBeGreaterThanOrEqual(5);
    expect(entry.competency?.learning_velocity).toBe(8);
    expect(entry.prompt_version).toBeTruthy();
    expect(entry.assessment_rubric_version).toBeTruthy();
    expect(entry.content_hash).toHaveLength(64);
  });
});

describe("dashboard + exports + corpus", () => {
  beforeEach(() => {
    clearQualityLedgerMemoryForTests();
  });

  it("builds offline corpus and dashboard aggregates", () => {
    const corpus = buildQualityLedgerOfflineCorpus();
    expect(corpus.length).toBeGreaterThanOrEqual(4);
    const dash = buildQualityLedgerDashboard(corpus);
    expect(dash.immutable).toBe(true);
    expect(dash.n).toBe(corpus.length);
    expect(dash.mean_vqi).not.toBeNull();
    expect(dash.recent.length).toBeGreaterThan(0);

    const timeline = buildTimeline(corpus, {
      diagnosis_slug: corpus[0]!.diagnosis_slug ?? undefined,
    });
    expect(timeline.length).toBeGreaterThan(0);

    const csv = exportLedgerCsv(corpus);
    expect(csv.split("\n").length).toBe(corpus.length + 1);
    const json = JSON.parse(exportLedgerJson(corpus));
    expect(json.format).toBe("vpsych-quality-ledger-export");
    const anon = JSON.parse(exportAnonymousResearchDataset(corpus));
    expect(anon.phi_stripped).toBe(true);
    expect(anon.records[0].learner_id).toBeUndefined();
    const fhir = exportFhirCompatibleBundle(corpus.slice(0, 1));
    expect(fhir.resourceType).toBe("Bundle");
    expect(fhir.entry.length).toBeGreaterThan(0);
  });

  it("persist falls back to memory without supabase", async () => {
    const entry = buildQualityLedgerEntry({
      session_id: "s-persist",
      learner_id: "l1",
      metrics: { vqi: { overall: 77 } },
    });
    const result = await persistQualityLedger(null, entry);
    expect(result.ok).toBe(true);
    expect(result.persisted).toBe("memory");
  });
});
