import { describe, expect, it } from "vitest";
import arMessages from "../../../messages/ar.json";
import enMessages from "../../../messages/en.json";
import mayaCase from "../../../personas/maya-chen.case.json";
import jordanCase from "../../../personas/jordan-hale.case.json";
import { defaultDisorderText, sessionGoalText } from "./card-text";

function translator(labels: Record<string, string>) {
  return Object.assign((k: string) => labels[k], {
    has: (k: string) => k in labels,
  });
}

const catalogueAr = translator(arMessages.skillTests.disorders);
const defaultsAr = translator(arMessages.avatars.defaultDisorders);
const goalsAr = translator(arMessages.avatars.sessionGoals);
const goalsEn = translator(enMessages.avatars.sessionGoals);

describe("Patient Library card text", () => {
  it("shows the library patients' diagnoses in Arabic", () => {
    for (const c of [mayaCase, jordanCase]) {
      const text = defaultDisorderText(c.clinical_core.disorder, catalogueAr, defaultsAr);
      expect(text).toMatch(/[؀-ۿ]/);
      expect(text).not.toMatch(/[A-Za-z]/);
    }
  });

  it("prefers the skill-test catalogue label when the wording matches it", () => {
    expect(
      defaultDisorderText("Posttraumatic Stress Disorder", catalogueAr, defaultsAr),
    ).toBe(arMessages.skillTests.disorders.ptsd);
  });

  it("shows every library patient goal in Arabic", () => {
    for (const c of [mayaCase, jordanCase]) {
      for (const goal of c.clinical_core.session_goals) {
        expect(sessionGoalText(goal, goalsAr)).not.toMatch(/^[\x20-\x7E–—]+$/);
      }
    }
  });

  it("keeps English pages on the stored wording", () => {
    const goal = mayaCase.clinical_core.session_goals[0];
    expect(sessionGoalText(goal, goalsEn)).toBe(goal);
  });

  it("shows text it has no translation for unchanged", () => {
    expect(sessionGoalText("  A goal an admin just wrote ", goalsAr)).toBe(
      "A goal an admin just wrote",
    );
    expect(defaultDisorderText("Something new", catalogueAr, defaultsAr)).toBe(
      "Something new",
    );
    expect(defaultDisorderText(null, catalogueAr, defaultsAr)).toBeNull();
  });
});
