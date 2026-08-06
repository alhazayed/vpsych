import { beforeEach, describe, expect, it } from "vitest";
import {
  assertBlindSubmission,
  buildCvlDashboard,
  buildCvlResearchPackage,
  buildPublicationSkeleton,
  buildRandomizationBlocks,
  buildValidationRoadmap,
  computeAllMetrics,
  createStudyWithAssignments,
  cvlClearMemory,
  cvlInsertBpc,
  cvlListAssignments,
  deriveClinicalFidelityLevel,
  revealArm,
  scoreAssessmentPair,
  scoreBpcComposite,
  sealCflToQualityLedger,
  toBlindedAssignmentView,
  validateAssessmentAccuracy,
  validateBpcSubmission,
  validateCreateStudy,
  validateHcfEvaluation,
} from "@/lib/cvl";

describe("CVL integrity", () => {
  beforeEach(() => cvlClearMemory());

  it("never fabricates metrics when vault empty", () => {
    const dash = buildCvlDashboard({
      studies: [],
      assignments: [],
      bpc: [],
      hcf: [],
      education: [],
      longitudinal: [],
      cfl: [],
    });
    expect(dash.metrics.every((m) => m.insufficient_data || m.score == null)).toBe(
      true,
    );
    expect(dash.notes[0]).toMatch(/No fabricated/i);

    const cfl = deriveClinicalFidelityLevel({
      case_ref: "x",
      metrics: dash.metrics,
    });
    expect(cfl.level).toBe("CFL-1");
    expect(cfl.human_approved).toBe(false);
    expect(cfl.rationale.join(" ")).toMatch(/Insufficient/);
  });

  it("keeps arms hidden on blinded assignment views", () => {
    const v = validateCreateStudy({
      kind: "blind_psychiatrist_challenge",
      title: "BPC pilot",
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const { study, assignments } = createStudyWithAssignments({
      draft: v.draft,
      cases: [
        { case_ref: "c1", disorder_slug: "ptsd" },
        { case_ref: "c2", disorder_slug: "bipolar-mania" },
      ],
      seed: "test-seed",
    });
    expect(assignments.length).toBeGreaterThanOrEqual(4);
    const view = toBlindedAssignmentView(assignments[0]!);
    expect(view.blinded).toBe(true);
    expect(view.arm_unknown_to_rater).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/real_patient|vpsych_avatar|standardized/);

    const blocked = revealArm(assignments[0]!, study.status);
    expect("error" in blocked).toBe(true);
  });

  it("requires blinding flags on BPC submit and scores composites from real ratings", () => {
    expect(assertBlindSubmission({}).ok).toBe(false);

    const v = validateCreateStudy({
      kind: "blind_psychiatrist_challenge",
      title: "BPC ratings",
    });
    if (!v.ok) throw new Error("bad study");
    const { assignments } = createStudyWithAssignments({
      draft: v.draft,
      cases: [{ case_ref: "pack", disorder_slug: "mdd-recurrent-moderate" }],
      reviewers_per_case: 2,
      seed: "rate",
    });
    const a = assignments[0]!;

    const bad = validateBpcSubmission({
      study_id: a.study_id,
      assignment_id: a.id,
      reviewer_token: a.reviewer_token,
      reviewer_type: a.reviewer_type,
      ratings: {
        clinical_realism: 4,
        emotional_realism: 4,
        diagnostic_consistency: 4,
        speech_naturalness: 4,
        thought_process: 4,
        affect: 4,
        rapport: 4,
        therapeutic_alliance: 4,
        disclosure_timing: 4,
        resistance: 4,
        educational_usefulness: 4,
      },
      confidence_pct: 70,
      blinded: false,
      arm_unknown_to_rater: true,
    });
    expect(bad.ok).toBe(false);

    const good = validateBpcSubmission({
      study_id: a.study_id,
      assignment_id: a.id,
      reviewer_token: a.reviewer_token,
      reviewer_type: a.reviewer_type,
      ratings: {
        clinical_realism: 4,
        emotional_realism: 4,
        diagnostic_consistency: 5,
        speech_naturalness: 4,
        thought_process: 4,
        affect: 4,
        rapport: 3,
        therapeutic_alliance: 4,
        disclosure_timing: 3,
        resistance: 3,
        educational_usefulness: 5,
      },
      would_teach_with_case: true,
      believed_arm: "unsure",
      confidence_pct: 55,
      blinded: true,
      arm_unknown_to_rater: true,
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    cvlInsertBpc(good.submission);
    expect(scoreBpcComposite(good.submission.ratings)).toBeGreaterThan(50);

    const metrics = computeAllMetrics({
      bpc: [good.submission],
      assignments: cvlListAssignments(),
      hcf: [],
      education: [],
      longitudinal: [],
    });
    // n=1 → still insufficient for CRI minN=3
    expect(metrics.find((m) => m.metric_id === "CRI")?.insufficient_data).toBe(
      true,
    );
  });

  it("HCF validation rejects out-of-range facets", () => {
    const bad = validateHcfEvaluation({
      study_id: "s",
      case_ref: "c",
      disorder_slug: "ptsd",
      rater_token: "r",
      facets: { naturalness: 101 },
    });
    expect(bad.ok).toBe(false);
  });

  it("randomization balances arms within blocks", () => {
    const blocks = buildRandomizationBlocks({
      seed: "balance",
      disorder_clusters: ["mood"],
      blocks_per_cluster: 1,
    });
    expect(new Set(blocks[0]!.sequence).size).toBe(3);
  });

  it("publication skeleton refuses invented results when empty", () => {
    const pkg = buildCvlResearchPackage({
      studies: [],
      assignments: [],
      bpc: [],
      hcf: [],
      education: [],
      longitudinal: [],
      cfl: [],
    });
    expect(pkg.is_fabricated).toBe(false);
    const ms = buildPublicationSkeleton(pkg);
    expect(ms.results.join(" ")).toMatch(/intentionally empty|No adequate/i);
    expect(buildValidationRoadmap(pkg.metrics)[0]?.priority).toBe("p0");
  });

  it("assessment accuracy requires paired expert scores (no fabrication)", () => {
    const bad = validateAssessmentAccuracy({
      study_id: "s",
      case_ref: "c",
      disorder_slug: "ptsd",
      rater_token: "rvw_x",
      expert_scores: { empathy: 80 },
      platform_scores: {},
    });
    expect(bad.ok).toBe(false);

    const good = validateAssessmentAccuracy({
      study_id: "s",
      case_ref: "c",
      disorder_slug: "ptsd",
      rater_token: "rvw_expert",
      expert_scores: { empathy: 80, risk: 70 },
      platform_scores: { empathy: 75, risk: 68 },
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.row.absolute_error).not.toBeNull();
    expect(scoreAssessmentPair({ a: 1 }, { a: 1 }).correlation).toBeNull();
  });

  it("CFL ledger seal is deferred until human approval path", () => {
    const cfl = deriveClinicalFidelityLevel({
      case_ref: "pack",
      metrics: computeAllMetrics({
        bpc: [],
        assignments: [],
        hcf: [],
        education: [],
        longitudinal: [],
      }),
    });
    const seal = sealCflToQualityLedger(cfl);
    expect(seal.ok).toBe(true);
    expect(seal.ledger_ref).toMatch(/^cvl-cfl:/);
    expect(cfl.human_approved).toBe(false);
  });
});
