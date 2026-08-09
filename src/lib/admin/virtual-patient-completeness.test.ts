import { describe, expect, it } from "vitest";
import { assessVirtualPatientCompleteness } from "@/lib/admin/virtual-patient-completeness";

describe("assessVirtualPatientCompleteness", () => {
  it("flags missing personality, voice, and clinical fields", () => {
    const result = assessVirtualPatientCompleteness({
      disorder: "",
      persona_prompt: "",
      human_personality: null,
      personalities: null,
      voice_profile_id: null,
      voice_id: null,
      voice_id_ar: null,
      clinical_core: null,
    });
    expect(result.isComplete).toBe(false);
    expect(result.incompleteReasons.length).toBeGreaterThan(0);
  });

  it("passes when bilingual personality, voice, and diagnosis present", () => {
    const result = assessVirtualPatientCompleteness({
      disorder: "Major depressive disorder",
      persona_prompt: "Hello",
      human_personality: {
        "en-US": { version: 1 } as never,
        "ar-JO": { version: 1 } as never,
      },
      personalities: {
        "en-US": { locale: "en-US", display_name: "A", persona_prompt: "x" },
        "ar-JO": { locale: "ar-JO", display_name: "ب", persona_prompt: "y" },
      } as never,
      voice_profile_id: "vp-1",
      voice_id: "abc",
      voice_id_ar: "def",
      clinical_core: { presenting_problem: "low mood" } as never,
    });
    expect(result.isComplete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });
});
