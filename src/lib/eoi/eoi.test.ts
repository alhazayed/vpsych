import { describe, expect, it, beforeEach } from "vitest";
import {
  buildEoiDashboard,
  buildEoiRecommendation,
  buildEoiResearchPackage,
  clusterOpportunities,
  computeBacklogScore,
  eoiMemoryClear,
  eoiMemoryInsert,
  eoiMemoryList,
  opportunitiesToCsv,
  runEducationalAnalyst,
  validateEoiSubmission,
  type EoiOpportunityRow,
} from "@/lib/eoi";

function sampleOpp(over: Partial<EoiOpportunityRow> = {}): EoiOpportunityRow {
  return {
    id: over.id ?? "o1",
    created_at: "2026-08-05T00:00:00.000Z",
    reviewer_id: "u1",
    anonymous: false,
    session_id: "s1",
    opportunity_type: "clinical_realism",
    educational_impact: 5,
    target_learners: ["psychiatry_resident"],
    competencies: ["trauma_interviewing", "empathy"],
    idea_text:
      "This PTSD patient disclosed trauma too early — slow the disclosure pacing",
    design_sketch: "Pause after first hint; require alliance check",
    expected_learning_experience: "Practice trauma-informed pacing",
    annotations: [],
    transcript_window: [],
    status: "open",
    cluster_id: null,
    fingerprint: over.fingerprint ?? "fp-trauma-1",
    platform_version: "0.1.0",
    release_version: "abc1234",
    prompt_version: "2.0.0",
    language: "en",
    disorder_slug: "ptsd",
    difficulty: "advanced",
    context: { is_defect: false },
    evidence: { is_defect: false },
    analyst: {},
    ...over,
  };
}

describe("EOI vault validation", () => {
  it("rejects short ideas and accepts educational payloads", () => {
    const bad = validateEoiSubmission({
      session_id: "s1",
      opportunity_type: "teaching_enhancement",
      educational_impact: 4,
      idea_text: "too short",
      context: {},
    });
    expect(bad.ok).toBe(false);

    const good = validateEoiSubmission({
      session_id: "s1",
      opportunity_type: "osce_improvement",
      educational_impact: 5,
      target_learners: ["medical_student"],
      competency_tags: ["mse", "communication"],
      idea_text: "This would make an excellent OSCE station with timed MSE",
      context: { session_id: "s1" },
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.submission.competencies).toEqual(["mse", "communication"]);
      expect(good.submission.opportunity_type).toBe("osce_improvement");
    }
  });

  it("never marks recommendations as defects", () => {
    const rec = buildEoiRecommendation({
      title: "Improve trauma disclosure timing",
      opportunity_type: "clinical_realism",
      impact_avg: 4.5,
      report_count: 3,
      idea_samples: ["Disclose trauma later"],
      disorders: ["ptsd"],
      learners: ["psychiatry_resident"],
      competencies: ["trauma_interviewing"],
      languages: ["en"],
    });
    expect(rec.is_defect).toBe(false);
    expect(rec.requires_human_approval).toBe(true);
    expect(rec.educational_rationale).toMatch(/not a software defect/i);
    expect(rec.cursor_prompt).toMatch(/How could this improve learning/);
  });
});

describe("EOI clustering + backlog", () => {
  it("clusters similar trauma timing ideas and scores backlog", () => {
    const a = sampleOpp({ id: "1", fingerprint: "same" });
    const b = sampleOpp({
      id: "2",
      fingerprint: "same",
      idea_text:
        "PTSD case discloses trauma too early — improve trauma disclosure timing",
    });
    const c = sampleOpp({
      id: "3",
      fingerprint: "other",
      opportunity_type: "supervisor_feedback",
      idea_text: "Show a supervisor coaching point after alliance rupture",
      competencies: ["therapeutic_alliance"],
    });

    const clusters = clusterOpportunities([a, b, c]);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const trauma = clusters.find((x) => x.report_count >= 2);
    expect(trauma).toBeTruthy();
    expect(trauma!.recommendation.is_defect).toBe(false);
    expect(trauma!.backlog_score).toBeGreaterThan(0);

    const score = computeBacklogScore({
      impact_avg: 5,
      report_count: 10,
      priority: "p0",
      effort: "s",
      research_high: true,
    });
    expect(score).toBeGreaterThan(80);
  });

  it("dashboard and analyst keep EOI off the defect path", () => {
    const rows = [
      sampleOpp({ id: "a" }),
      sampleOpp({
        id: "b",
        opportunity_type: "adaptive_learning",
        idea_text: "Learner should receive reflective questions after this mistake",
        competencies: ["clinical_reasoning"],
        fingerprint: "fp-adapt",
      }),
    ];
    const clusters = clusterOpportunities(rows);
    const dash = buildEoiDashboard(rows, clusters);
    expect(dash.totals.opportunities).toBe(2);
    expect(dash.eoi_version).toBeTruthy();

    const analyst = runEducationalAnalyst(rows);
    expect(analyst.notes.some((n) => /not bug reports/i.test(n))).toBe(true);
    expect(analyst.research_questions[0]).toMatch(/learner performance/i);

    const pkg = buildEoiResearchPackage(rows, clusters);
    expect(pkg.is_defect).toBe(false);
    expect(pkg.kind).toBe("educational_opportunity");

    const csv = opportunitiesToCsv(rows, true);
    expect(csv).toContain("opportunity_type");
    expect(csv).toMatch(/redacted/);
  });
});

describe("EOI memory vault", () => {
  beforeEach(() => eoiMemoryClear());

  it("stores opportunities separately from any defect ledger", () => {
    const row = eoiMemoryInsert({
      reviewer_id: "u1",
      anonymous: false,
      session_id: "s1",
      opportunity_type: "reflection_opportunity",
      educational_impact: 4,
      target_learners: ["psychology_student"],
      competencies: ["empathy"],
      idea_text: "Add reflective prompts after guilt disclosure",
      design_sketch: null,
      expected_learning_experience: null,
      annotations: [],
      transcript_window: [],
      fingerprint: "mem-1",
      platform_version: null,
      release_version: null,
      prompt_version: null,
      language: "en",
      disorder_slug: "mdd",
      difficulty: null,
      context: { is_defect: false },
      evidence: { is_defect: false },
    });
    expect(row.status).toBe("open");
    expect(eoiMemoryList()).toHaveLength(1);
    expect(row.context.is_defect).toBe(false);
  });
});
