import { describe, expect, it } from "vitest";
import {
  buildConsortFlow,
  buildCvpDashboard,
  buildPublicationPackage,
  buildReliabilityReport,
  cohensKappa,
  fleissKappa,
  hashInvitationToken,
  icc21,
  mintInvitationToken,
  planRandomizedAllocations,
  scrubFreeText,
  summarizeEducationalOutcomes,
} from "@/lib/cvp";

describe("cohensKappa", () => {
  it("returns 1 for perfect agreement", () => {
    const r = cohensKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(r.value).toBe(1);
    expect(r.interpretation).toBe("almost_perfect");
  });

  it("returns null for insufficient data", () => {
    expect(cohensKappa([1], [1]).value).toBeNull();
  });
});

describe("fleissKappa / icc", () => {
  it("computes fleiss on multi-rater matrix", () => {
    const r = fleissKappa([
      [5, 5, 4],
      [3, 3, 3],
      [4, 5, 4],
      [2, 2, 1],
    ]);
    expect(r.n_raters).toBe(3);
    expect(r.value).not.toBeNull();
  });

  it("computes icc21", () => {
    const r = icc21([
      [4, 4, 5],
      [3, 3, 2],
      [5, 5, 5],
      [2, 1, 2],
    ]);
    expect(r.method).toBe("icc_2_1");
    expect(r.value).not.toBeNull();
  });
});

describe("buildReliabilityReport", () => {
  it("aggregates dual scores", () => {
    const report = buildReliabilityReport({
      dualScores: {
        s1: { r1: 4, r2: 4 },
        s2: { r1: 3, r2: 2 },
        s3: { r1: 5, r2: 5 },
      },
      cronbachMatrix: [
        [4, 5, 4],
        [3, 3, 2],
        [5, 5, 5],
      ],
    });
    expect(report.sample_sessions).toBe(3);
    expect(report.sample_raters).toBe(2);
    expect(report.cohens_kappa?.value).not.toBeNull();
    expect(report.disclaimer).toMatch(/not published/i);
  });
});

describe("planRandomizedAllocations", () => {
  it("is deterministic for the same enrollment", () => {
    const avatars = [
      { id: "a1", available_locales: ["en-US"] },
      { id: "a2", available_locales: ["ar-JO"] },
      { id: "a3", available_locales: ["en-US", "ar-JO"] },
    ];
    const p1 = planRandomizedAllocations({
      studyId: "study",
      enrollmentId: "enr1",
      avatars,
      count: 3,
    });
    const p2 = planRandomizedAllocations({
      studyId: "study",
      enrollmentId: "enr1",
      avatars,
      count: 3,
    });
    expect(p1).toEqual(p2);
    expect(p1).toHaveLength(3);
    expect(p1[1]?.allocation_arm).toBe("blind_challenge");
  });
});

describe("deidentify / export", () => {
  it("scrubs emails", () => {
    expect(scrubFreeText("Contact a@b.co please", "standard")).toContain(
      "[REDACTED_EMAIL]",
    );
  });

  it("builds publication package csv", () => {
    const pkg = buildPublicationPackage({
      kind: "publication_package",
      deidentifyLevel: "standard",
      studySlug: "cvp-pilot",
      ratingRows: [
        {
          study_id: "st1",
          session_id: "se1",
          reviewer_id: "u1",
          clinical_realism: 4,
          educational_value: 5,
          free_text: "ok",
        },
      ],
      dashboardInput: {
        study: null,
        enrollments: [],
        invitations: [],
        assignments: [],
        blind: [],
        dualScores: {},
        institutions: [],
        outcomes: [],
        snapshots: [],
        calibration: [],
        exports: [],
      },
    });
    expect(pkg.ratings_csv).toContain("clinical_realism");
    expect(pkg.ratings[0]?.rater_pseudonym).toHaveLength(12);
  });
});

describe("outcomes / consort / dashboard", () => {
  it("summarizes pre/post change", () => {
    const s = summarizeEducationalOutcomes([
      {
        enrollment_id: "e1",
        timepoint: "baseline",
        instrument_slug: "self_efficacy",
        scores: { overall: 40 },
      },
      {
        enrollment_id: "e1",
        timepoint: "post",
        instrument_slug: "self_efficacy",
        scores: { overall: 55 },
      },
    ]);
    expect(s[0]?.mean_change).toBe(15);
    expect(s[0]?.paired_n).toBe(1);
  });

  it("builds consort and dashboard", () => {
    const consort = buildConsortFlow({
      invited: 20,
      excluded: 2,
      enrolled: 18,
      allocatedStandard: 12,
      allocatedControl: 3,
      allocatedBlind: 3,
      completedAssignments: 10,
      completedOutcomes: 8,
      analysed: 8,
    });
    expect(consort.randomized).toBe(18);

    const dash = buildCvpDashboard({
      study: {
        id: "s1",
        slug: "pilot",
        title: "Pilot",
        protocol_version: "1.0",
        status: "active",
        irb_reference: "IRB-001",
        consort_registered: true,
        description: null,
        settings: {},
        started_at: null,
        ended_at: null,
        created_at: "2026-08-06T00:00:00Z",
      },
      enrollments: [
        { is_active: true, institution_id: "i1" },
        { is_active: false, institution_id: "i1" },
      ],
      invitations: [
        { status: "pending" },
        { status: "accepted" },
        { status: "expired" },
      ],
      assignments: [
        { status: "completed", allocation_arm: "standard", enrollment_id: "e1" },
        {
          status: "pending",
          allocation_arm: "blind_challenge",
          enrollment_id: "e1",
        },
      ],
      blind: [{ overall_realism: 4, would_use_in_training: true }],
      dualScores: { se1: { r1: 4, r2: 4 } },
      institutions: [
        {
          institution_id: "i1",
          institution_name: "Test U",
          site_code: "A",
          enrollments: 2,
          completed_assignments: 1,
          avg_realism: 4,
          avg_educational_value: 4.5,
          blind_scores: 1,
        },
      ],
      outcomes: [],
      snapshots: [
        { enrollment_id: "e1" },
        { enrollment_id: "e1" },
      ],
      calibration: [{ expert_scores: { overall: 4 } }],
      exports: [{ status: "completed" }],
    });
    expect(dash.enrollments.active).toBe(1);
    expect(dash.longitudinal.reviewers_with_2plus_snapshots).toBe(1);
    expect(dash.reliability.sample_sessions).toBe(1);
  });
});

describe("invitations", () => {
  it("hashes tokens stably", () => {
    const { token, tokenHash } = mintInvitationToken();
    expect(hashInvitationToken(token)).toBe(tokenHash);
    expect(tokenHash).toHaveLength(64);
  });
});
