import { describe, expect, it } from "vitest";
import {
  findVoiceGenderMismatches,
  isPatientGender,
  VOICE_GENDERS,
  voiceGenderOf,
  voiceProfileGender,
  voicesForPatientGender,
} from "@/lib/voice/voice-gender";
import { VERIFIED_VOICE_LANGUAGES } from "@/lib/voice/voice-language";

const AISHA = "m3yAHyFEFKtbCIM5n7GF"; // female EN
const ADAM = "s3TPKV1kjDlVtZbl4Ksh"; // male EN
const FADI = "oJQlz7pz2yWd7MRmDUXm"; // male AR
const HIBA = "Wim44P0dU9HtjyzNnFsv"; // female AR

describe("voice gender", () => {
  it("knows the gender of every verified voice", () => {
    for (const id of Object.keys(VERIFIED_VOICE_LANGUAGES)) {
      expect(VOICE_GENDERS[id], id).toMatch(/^(female|male)$/);
    }
  });

  it("only male and female are patient genders", () => {
    expect(isPatientGender("female")).toBe(true);
    expect(isPatientGender("male")).toBe(true);
    expect(isPatientGender("non-binary")).toBe(false);
    expect(isPatientGender("unspecified")).toBe(false);
    expect(isPatientGender(null)).toBe(false);
  });

  it("prefers the verified table over an admin-typed profile label", () => {
    expect(voiceGenderOf(ADAM, { voice_id: ADAM, gender: "female" })).toBe("male");
    expect(voiceGenderOf("unlisted", { voice_id: "unlisted", gender: " Female " })).toBe(
      "female",
    );
    expect(voiceGenderOf("unlisted")).toBeNull();
    expect(voiceProfileGender({ gender: "male" })).toBe("male");
  });

  it("current casting matches: Maya female, Jordan male", () => {
    expect(
      findVoiceGenderMismatches({
        gender: "female",
        voiceProfile: { voice_id: HIBA, gender: "female" },
        voice_id: AISHA,
        voice_id_ar: HIBA,
      }),
    ).toEqual([]);
    expect(
      findVoiceGenderMismatches({
        gender: "male",
        voiceProfile: { voice_id: FADI, gender: "male" },
        voice_id: ADAM,
        voice_id_ar: FADI,
      }),
    ).toEqual([]);
  });

  it("flags every voice of the other gender", () => {
    expect(
      findVoiceGenderMismatches({
        gender: "female",
        voiceProfile: { voice_id: FADI, gender: "male" },
        voice_id: ADAM,
        voice_id_ar: FADI,
      }),
    ).toEqual([
      { slot: "voice_profile", voiceId: FADI, voiceGender: "male" },
      { slot: "voice_id", voiceId: ADAM, voiceGender: "male" },
    ]);
  });

  it("filters voice choices to the patient's gender", () => {
    const voices = [
      { id: "a", voice_id: AISHA, gender: "female" },
      { id: "b", voice_id: ADAM, gender: "male" },
      { id: "c", voice_id: "unlisted", gender: null },
    ];
    expect(voicesForPatientGender(voices, "female").map((v) => v.id)).toEqual(["a"]);
    expect(voicesForPatientGender(voices, "male").map((v) => v.id)).toEqual(["b"]);
    // Gender not chosen yet: nothing is hidden.
    expect(voicesForPatientGender(voices, "unspecified")).toHaveLength(3);
  });
});
