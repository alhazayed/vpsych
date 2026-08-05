import { describe, expect, it, beforeEach } from "vitest";
import {
  buildEngineeringRecommendation,
  buildFingerprint,
  buildResearchPackage,
  buildCqiDashboard,
  clusterFlags,
  decryptText,
  encryptText,
  flagsToCsv,
  memoryClearAll,
  memoryInsertFlag,
  memoryListFlags,
  normalizeScores,
  runQualityAnalyst,
  validateFlagSubmission,
  type CqiFlagRow,
} from "@/lib/cqi";

function sampleFlag(over: Partial<CqiFlagRow> = {}): CqiFlagRow {
  return {
    id: over.id ?? "f1",
    created_at: "2026-08-05T00:00:00.000Z",
    reviewer_id: "u1",
    anonymous: false,
    session_id: "s1",
    category: "clinical_realism",
    severity: "high",
    confidence: "definitely",
    free_text: "Mania speech was too slow and organized for acute mania",
    suggested_improvement: "Increase pressured speech",
    expected_behaviour: "Pressured, hard to interrupt",
    reduces_educational_quality: true,
    usable_in_residency: false,
    scores: { clinical_realism: 3, conversation_realism: 4 },
    would_recommend: false,
    annotations: [{ quote: "I slept fine", note: "Should deny sleep need" }],
    transcript_window: [
      { role: "assistant", content: "I slept fine actually" },
    ],
    status: "submitted",
    cluster_id: null,
    fingerprint: "",
    platform_version: "0.1.0",
    release_version: "abc1234",
    prompt_version: "2.0.0",
    pme_version: null,
    disorder_slug: "bipolar-mania",
    language: "en",
    context: {
      session_id: "s1",
      assessment_id: "s1",
      patient_id: "a1",
      avatar_id: "a1",
      case_instance_id: null,
      disorder: "Bipolar mania",
      disorder_slug: "bipolar-mania",
      difficulty: "advanced",
      language: "en",
      voice: { voice_id: "v1" },
      llm_model: "gpt-5",
      prompt_version: "2.0.0",
      pme_version: null,
      tre_version: null,
      timestamp: "2026-08-05T00:00:00.000Z",
      transcript_window: [],
      current_message: null,
      patient_mind_state: null,
      assessment_state: null,
      browser: { user_agent: "test" },
      platform_version: "0.1.0",
      release_version: "abc1234",
      cqi_version: "1.0.0",
    },
    evidence: {},
    analyst_notes: {},
    ...over,
  };
}

describe("CQI vault validation", () => {
  it("rejects short free text and accepts structured payload", () => {
    const bad = validateFlagSubmission({
      session_id: "s1",
      category: "voice",
      severity: "low",
      confidence: "possibly",
      free_text: "short",
      context: {},
    });
    expect(bad.ok).toBe(false);

    const good = validateFlagSubmission({
      session_id: "s1",
      category: "voice",
      severity: "low",
      confidence: "possibly",
      free_text: "Arabic TTS sounded robotic on long turns",
      context: { session_id: "s1" },
      scores: { voice_realism: 2 },
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(normalizeScores(good.submission.scores).voice_realism).toBe(2);
    }
  });
});

describe("CQI clustering + analyst", () => {
  it("clusters similar mania speech complaints", () => {
    const a = sampleFlag({
      id: "1",
      free_text: "Mania speech unrealistic — too slow and calm",
    });
    a.fingerprint = buildFingerprint({
      category: a.category,
      severity: a.severity,
      free_text: a.free_text,
      disorder_slug: a.disorder_slug,
      language: a.language,
    });
    const b = sampleFlag({
      id: "2",
      free_text: "Mania speech unrealistic and too organized",
    });
    b.fingerprint = buildFingerprint({
      category: b.category,
      severity: b.severity,
      free_text: b.free_text,
      disorder_slug: b.disorder_slug,
      language: b.language,
    });
    const c = sampleFlag({
      id: "3",
      category: "user_interface",
      severity: "low",
      free_text: "Timer hard to read on mobile",
      disorder_slug: "mdd-recurrent-moderate",
    });
    c.fingerprint = buildFingerprint({
      category: c.category,
      severity: c.severity,
      free_text: c.free_text,
      disorder_slug: c.disorder_slug,
      language: c.language,
    });

    const clusters = clusterFlags([a, b, c]);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const mania = clusters.find((cl) =>
      cl.affected_disorders.includes("bipolar-mania"),
    );
    expect(mania?.report_count).toBeGreaterThanOrEqual(2);
    expect(mania?.engineering.requires_human_approval).toBe(true);
    expect(mania?.engineering.github_issue_md).toMatch(/human approval/i);

    const report = runQualityAnalyst([a, b, c]);
    expect(report.cluster_count).toBe(clusters.length);
    expect(report.notes.some((n) => /approval/i.test(n))).toBe(true);

    const dash = buildCqiDashboard([a, b, c], clusters);
    expect(dash.totals.flags).toBe(3);
    expect(dash.score_averages.clinical_realism).toBeTruthy();
  });

  it("engineering assistant never claims auto-PR", () => {
    const rec = buildEngineeringRecommendation({
      title: "Voice latency",
      category: "voice",
      severity: "high",
      report_count: 5,
      sample_texts: ["TTS lag after each turn"],
      disorders: ["gad-with-panic"],
      languages: ["en", "ar"],
      prompts: ["2.0.0"],
    });
    expect(rec.requires_human_approval).toBe(true);
    expect(rec.cursor_prompt).toMatch(/do not auto-create/i);
    expect(rec.priority).toBe("p1");
  });
});

describe("CQI export + memory vault", () => {
  beforeEach(() => memoryClearAll());

  it("anonymizes research package and csv", () => {
    const f = sampleFlag({ id: "exp1" });
    f.fingerprint = "abc";
    const pkg = buildResearchPackage([f], null, { redact_free_text: true });
    expect(pkg.anonymized).toBe(true);
    expect(pkg.flags[0]?.reviewer_id).toBeNull();
    expect(pkg.flags[0]?.free_text).toBe("[redacted]");
    const csv = flagsToCsv(pkg.flags);
    expect(csv.split("\n")[0]).toMatch(/category/);
  });

  it("memory vault preserves flags when DB absent", () => {
    memoryInsertFlag(sampleFlag({ id: "ignored" }));
    expect(memoryListFlags()).toHaveLength(1);
  });
});

describe("CQI encryption helper", () => {
  it("round-trips when key present", () => {
    const prev = process.env.CQI_ENCRYPTION_KEY;
    process.env.CQI_ENCRYPTION_KEY = "test-cqi-key-32bytes-minimum!!";
    const { free_text, free_text_enc } = encryptText("secret observation");
    expect(free_text).toBe("[encrypted]");
    expect(free_text_enc?.alg).toBe("aes-256-gcm");
    expect(decryptText(free_text, free_text_enc)).toBe("secret observation");
    if (prev === undefined) delete process.env.CQI_ENCRYPTION_KEY;
    else process.env.CQI_ENCRYPTION_KEY = prev;
  });
});
