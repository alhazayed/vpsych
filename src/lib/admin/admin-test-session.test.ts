import { describe, expect, it } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  ADMIN_TEST_LABEL,
  assertAdminTestSkipAllowed,
  assertAvatarEligibleForAdminTest,
  isAdminTestSnapshot,
  isLearnerTrainingSnapshot,
  stripAdminTestMarker,
  withAdminTestMarker,
} from "@/lib/admin/admin-test-session";

function baseSnapshot(): CaseInstanceSnapshot {
  return {
    version: 2,
    assessment_id: "VPSY-TEST",
    persona: {
      id: "p1",
      slug: "p1",
      display_name: "Test",
      avatar_id: "a1",
    },
    primary_diagnosis: {
      id: "d1",
      slug: "mdd",
      name: "MDD",
      dsm5_code: null,
      icd10_code: null,
      icd11_code: null,
    },
    comorbidities: [],
    difficulty: "intermediate",
    difficulty_modifiers: {} as CaseInstanceSnapshot["difficulty_modifiers"],
    therapy_modality: "supportive",
    therapy_reaction_rules: {},
    locale: "en-US",
    severity: "moderate",
    clinical_core: {} as CaseInstanceSnapshot["clinical_core"],
    randomized_context: {} as CaseInstanceSnapshot["randomized_context"],
    memory_scope: "case_instance",
    generated_at: new Date().toISOString(),
  };
}

describe("admin-test-session helpers", () => {
  it("detects admin_test marker strictly", () => {
    expect(isAdminTestSnapshot(null)).toBe(false);
    expect(isAdminTestSnapshot({})).toBe(false);
    expect(isAdminTestSnapshot({ admin_test: false })).toBe(false);
    expect(isAdminTestSnapshot({ admin_test: "true" })).toBe(false);
    expect(isAdminTestSnapshot({ admin_test: true })).toBe(true);
  });

  it("withAdminTestMarker sets label and does not mutate input", () => {
    const snap = baseSnapshot();
    const marked = withAdminTestMarker(snap);
    expect(marked.admin_test).toBe(true);
    expect(marked.admin_test_label).toBe(ADMIN_TEST_LABEL);
    expect(snap).not.toHaveProperty("admin_test");
    expect(isLearnerTrainingSnapshot(marked)).toBe(false);
    expect(isLearnerTrainingSnapshot(snap)).toBe(true);
  });

  it("stripAdminTestMarker removes forged markers for learner path", () => {
    const marked = withAdminTestMarker(baseSnapshot());
    const stripped = stripAdminTestMarker(marked);
    expect(isAdminTestSnapshot(stripped)).toBe(false);
  });

  it("assertAdminTestSkipAllowed requires marker + admin + owner", () => {
    const snapshot = withAdminTestMarker(baseSnapshot());
    expect(
      assertAdminTestSkipAllowed({
        snapshot,
        callerIsAdmin: true,
        therapistId: "u1",
        callerId: "u1",
      }),
    ).toEqual({ ok: true });

    expect(
      assertAdminTestSkipAllowed({
        snapshot,
        callerIsAdmin: false,
        therapistId: "u1",
        callerId: "u1",
      }).ok,
    ).toBe(false);

    expect(
      assertAdminTestSkipAllowed({
        snapshot,
        callerIsAdmin: true,
        therapistId: "u1",
        callerId: "u2",
      }).ok,
    ).toBe(false);

    expect(
      assertAdminTestSkipAllowed({
        snapshot: baseSnapshot(),
        callerIsAdmin: true,
        therapistId: "u1",
        callerId: "u1",
      }).ok,
    ).toBe(false);
  });

  it("assertAvatarEligibleForAdminTest allows testing only (MVP)", () => {
    expect(assertAvatarEligibleForAdminTest("testing")).toEqual({ ok: true });
    expect(assertAvatarEligibleForAdminTest("draft").ok).toBe(false);
    expect(assertAvatarEligibleForAdminTest("published").ok).toBe(false);
    expect(assertAvatarEligibleForAdminTest("archived").ok).toBe(false);
    for (const status of ["draft", "published", "archived"] as const) {
      const r = assertAvatarEligibleForAdminTest(status);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(409);
    }
  });
});
