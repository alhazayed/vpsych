import { describe, expect, it } from "vitest";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { patientLabelKey } from "./patient-label";

describe("patientLabelKey", () => {
  it("uses the feminine label only for female patients", () => {
    expect(patientLabelKey("female")).toBe("patientFemale");
    expect(patientLabelKey(" Female ")).toBe("patientFemale");
    expect(patientLabelKey("male")).toBe("patient");
    expect(patientLabelKey("non-binary")).toBe("patient");
    expect(patientLabelKey(null)).toBe("patient");
    expect(patientLabelKey(undefined)).toBe("patient");
  });

  it("has both labels in both locales", () => {
    for (const ns of ["transcript", "voiceTurn"] as const) {
      expect(ar.therapyRoom[ns].patient).toBe("المريض");
      expect(ar.therapyRoom[ns].patientFemale).toBe("المريضة");
      expect(en.therapyRoom[ns].patient).toBe("Patient");
      expect(en.therapyRoom[ns].patientFemale).toBe("Patient");
    }
  });
});
