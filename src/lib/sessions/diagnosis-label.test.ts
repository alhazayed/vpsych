import { describe, expect, it } from "vitest";
import arMessages from "../../../messages/ar.json";
import enMessages from "../../../messages/en.json";
import mayaCase from "../../../personas/maya-chen.case.json";
import {
  disorderNameText,
  sessionDiagnosis,
  sessionDiagnosisText,
} from "./diagnosis-label";

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

describe("diagnosis display text", () => {
  const labels: Record<string, string> = { ptsd: "اضطراب ما بعد الصدمة" };
  const t = Object.assign((k: string) => labels[k], {
    has: (k: string) => k in labels,
  });

  it("translates a stored English name that matches the catalogue", () => {
    expect(disorderNameText("Posttraumatic Stress Disorder", t)).toBe(
      "اضطراب ما بعد الصدمة",
    );
    expect(disorderNameText("Alcoholic", t)).toBe("Alcoholic");
    expect(disorderNameText("  ", t)).toBeNull();
  });

  it("translates a session's diagnosis by slug and hides it for tests", () => {
    const snap = { primary_diagnosis: { slug: "ptsd", name: "PTSD" } };
    expect(
      sessionDiagnosisText(
        { clinical_snapshot: snap as never },
        t,
      ),
    ).toBe("اضطراب ما بعد الصدمة");
    expect(
      sessionDiagnosisText(
        { clinical_snapshot: snap as never, skill_test_assignment_id: "a1" },
        t,
      ),
    ).toBeNull();
  });
});

describe("diagnosis display text on Arabic pages", () => {
  function translator(labels: Record<string, string>) {
    return Object.assign((k: string) => labels[k], {
      has: (k: string) => k in labels,
    });
  }
  const catalogueAr = translator(arMessages.skillTests.disorders);
  const defaultsAr = translator(arMessages.avatars.defaultDisorders);
  const catalogueEn = translator(enMessages.skillTests.disorders);
  const defaultsEn = translator(enMessages.avatars.defaultDisorders);

  it("shows an old session's avatar diagnosis in Arabic", () => {
    const session = {
      clinical_snapshot: null,
      avatars: { disorder: mayaCase.clinical_core.disorder },
    };
    const text = sessionDiagnosisText(session, catalogueAr, defaultsAr);
    expect(text).toBe(
      arMessages.avatars.defaultDisorders["mdd-recurrent-anxious-distress"],
    );
    expect(sessionDiagnosisText(session, catalogueEn, defaultsEn)).toBe(
      mayaCase.clinical_core.disorder,
    );
  });

  it("shows a case name with no slug label in Arabic when it is authored", () => {
    const snap = {
      primary_diagnosis: {
        slug: "not-in-catalogue",
        name: "Generalized  Anxiety Disorder, with panic attacks",
      },
    };
    expect(
      sessionDiagnosisText({ clinical_snapshot: snap as never }, catalogueAr, defaultsAr),
    ).toBe(arMessages.avatars.defaultDisorders["gad-with-panic-attacks"]);
  });

  it("gives every library and ladder case slug an Arabic label", () => {
    for (const slug of Object.keys(enMessages.skillTests.disorders)) {
      const snap = { primary_diagnosis: { slug, name: "English name" } };
      const text = sessionDiagnosisText(
        { clinical_snapshot: snap as never },
        catalogueAr,
        defaultsAr,
      );
      expect(text).not.toMatch(/[A-Za-z]{3}/);
    }
  });

  it("still hides the diagnosis of a skill test on Arabic pages", () => {
    expect(
      sessionDiagnosisText(
        {
          clinical_snapshot: null,
          skill_test_assignment_id: "a1",
          avatars: { disorder: mayaCase.clinical_core.disorder },
        },
        catalogueAr,
        defaultsAr,
      ),
    ).toBeNull();
  });
});
