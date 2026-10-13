import { describe, expect, it } from "vitest";
import { describedPatientCues } from "./patient-cues";

describe("describedPatientCues", () => {
  it("describes nothing for a calm, idle patient", () => {
    expect(
      describedPatientCues({
        activeCues: ["idle_breathing", "blink"],
        animationClasses: ["trm-patient--blink", "trm-patient--eye-glance"],
      }),
    ).toEqual([]);
  });

  it("reads cues from engine cues and from scheduler classes", () => {
    expect(
      describedPatientCues({
        activeCues: ["cross_arms"],
        animationClasses: ["trm-patient--tears", "trm-patient--smile-soft"],
      }),
    ).toEqual(["tears", "crossArms", "smile"]);
  });

  it("merges fidget and restlessness into one cue", () => {
    expect(
      describedPatientCues({ activeCues: ["fidget", "restlessness"] }),
    ).toEqual(["fidget"]);
  });

  it("drops eye contact while the patient looks away", () => {
    expect(
      describedPatientCues({ activeCues: ["look_away", "eye_contact"] }),
    ).toEqual(["lookAway"]);
  });
});
