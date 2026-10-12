import { describe, expect, it } from "vitest";
import {
  namesSealedDiagnosis,
  sealedDiagnosisLabels,
} from "@/lib/ai/diagnosis-labels";
import {
  hasCanonicalFactExposure,
  validatePatientReply,
} from "@/lib/ai/reply-validation";
import { createSpeechReleaseGate } from "@/lib/sessions/speech-release-gate";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

function snap(
  slug: string,
  name: string,
  comorbidities: Array<{ slug: string; name: string }> = [],
) {
  return {
    primary_diagnosis: { id: "d1", slug, name },
    comorbidities,
  } as unknown as CaseInstanceSnapshot;
}

const PTSD = sealedDiagnosisLabels(
  snap("ptsd", "Posttraumatic stress disorder", [
    { slug: "alcohol-use-disorder", name: "Alcohol use disorder" },
  ]),
);
const ADHD = sealedDiagnosisLabels(
  snap("adult-adhd", "Adult ADHD, predominantly inattentive"),
);
const MDD = sealedDiagnosisLabels(
  snap("mdd-recurrent-moderate", "Major depressive disorder, recurrent, moderate"),
);

describe("sealedDiagnosisLabels", () => {
  it("is empty without a case, so practice and unknown sessions are unaffected", () => {
    expect(sealedDiagnosisLabels(null)).toEqual([]);
    expect(sealedDiagnosisLabels({} as CaseInstanceSnapshot)).toEqual([]);
  });

  it("covers the diagnosis, its comorbidities and the case's own names", () => {
    expect(PTSD).toEqual(
      expect.arrayContaining([
        "PTSD",
        "ما بعد الصدمة",
        "alcohol use disorder",
        "Posttraumatic stress disorder",
      ]),
    );
  });

  it("falls back to the case's name for a disorder outside the catalogue", () => {
    expect(sealedDiagnosisLabels(snap("custom-x", "Hoarding disorder"))).toEqual([
      "Hoarding disorder",
    ]);
  });
});

describe("namesSealedDiagnosis", () => {
  it.each([
    "My GP said it was PTSD.",
    "They called it post-traumatic stress, whatever that means.",
    "قالوا لي عندي اضطراب ما بعد الصدمة.",
    "Honestly I think my drinking is alcohol use disorder.",
    "The psychiatrist wrote down major depressive disorder.",
    "عندي اكتئاب جسيم من سنين.",
    "عندي الاكتئاب الجسيم",
  ])("catches %j", (text) => {
    const labels = /depress|اكتئاب/i.test(text) ? MDD : PTSD;
    expect(namesSealedDiagnosis(text, labels)).toBe(true);
  });

  it("folds Arabic spelling variants", () => {
    // A ya written without its hamza still matches.
    expect(namesSealedDiagnosis("في عندي اكتياب جسيم", MDD)).toBe(true);
  });

  it.each([
    "I can't sleep, and loud noises make me jump.",
    "I've been feeling really depressed and tired.",
    "أنا مكتئب وما بنام منيح.",
    "I keep having panic attacks at work.",
    "Let me add one thing: I drink most nights.",
  ])("lets symptom talk through: %j", (text) => {
    expect(namesSealedDiagnosis(text, [...PTSD, ...MDD, ...ADHD])).toBe(false);
  });

  it("matches abbreviations only in capitals and as whole words", () => {
    expect(namesSealedDiagnosis("They said I have ADD.", ADHD)).toBe(true);
    expect(namesSealedDiagnosis("I want to add that I lose things.", ADHD)).toBe(false);
    expect(namesSealedDiagnosis("PTSDs", PTSD)).toBe(false);
  });
});

describe("reply gate with sealed labels", () => {
  it("rejects a test reply naming the diagnosis and passes the same reply in practice", () => {
    const reply = "Yeah, they diagnosed me with PTSD after the accident.";
    const exam = validatePatientReply(reply, { sealedDiagnosisLabels: PTSD });
    expect(exam).toEqual({ ok: false, reason: "diagnosis_named" });
    expect(validatePatientReply(reply, {}).ok).toBe(true);
    expect(validatePatientReply(reply).ok).toBe(true);
  });

  it("holds streamed speech from the sentence that names the diagnosis", () => {
    expect(hasCanonicalFactExposure("It's PTSD, they said.", { sealedDiagnosisLabels: PTSD })).toBe(true);
    expect(hasCanonicalFactExposure("It's PTSD, they said.", {})).toBe(false);

    const gate = createSpeechReleaseGate({ sealedDiagnosisLabels: PTSD });
    expect(gate.offer("I don't sleep much.")).toEqual(["I don't sleep much."]);
    expect(gate.offer("The doctor said PTSD.")).toEqual([]);
    expect(gate.latched()).toBe(true);
  });
});
