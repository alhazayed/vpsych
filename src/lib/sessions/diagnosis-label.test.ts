import { describe, expect, it } from "vitest";
import { sessionDiagnosis } from "./diagnosis-label";

const primary = {
  id: "d1",
  slug: "gad-with-panic",
  name: "Generalized anxiety disorder",
  dsm5_code: null,
  icd10_code: null,
  icd11_code: null,
};

describe("sessionDiagnosis", () => {
  it("uses the session's case, not the avatar's legacy disorder", () => {
    expect(
      sessionDiagnosis({
        clinical_snapshot: { primary_diagnosis: primary },
        avatars: { disorder: "Major depressive disorder" },
      }),
    ).toEqual({ slug: "gad-with-panic", name: "Generalized anxiety disorder" });
  });

  it("hides the diagnosis for skill test sessions", () => {
    expect(
      sessionDiagnosis({
        clinical_snapshot: { primary_diagnosis: primary },
        skill_test_assignment_id: "t1",
        avatars: { disorder: "Major depressive disorder" },
      }),
    ).toBeNull();
  });

  it("falls back to the avatar only when the snapshot has no diagnosis", () => {
    expect(
      sessionDiagnosis({ clinical_snapshot: null, avatars: { disorder: "PTSD" } }),
    ).toEqual({ slug: null, name: "PTSD" });
    expect(sessionDiagnosis({ clinical_snapshot: null, avatars: null })).toBeNull();
  });
});
