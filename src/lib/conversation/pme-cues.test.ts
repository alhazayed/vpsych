import { describe, expect, it } from "vitest";
import { pmeUxCuesFromSession } from "@/lib/conversation/pme-cues";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ResolvedAvatar } from "@/lib/types";

const avatar = {
  id: "a1",
  schema_version: 2,
  locale: "en-US",
  language: "en",
  direction: "ltr" as const,
  name: "Maya",
  disorder: "Major Depressive Disorder",
  age: 28,
  gender: "female",
  portrait_url: null,
  persona_prompt: "",
  system_prompt: "",
  ideal_guidelines: {},
  rubric: [],
  dialect: null,
  voice_id: null,
  stt_lang: "en-US",
  tts_lang: "en-US",
  fallback_replies: [],
} as ResolvedAvatar;

function snap(partial: {
  slug: string;
  severity?: "mild" | "moderate" | "severe";
  suicidal?: "none" | "active_with_plan";
}): CaseInstanceSnapshot {
  return {
    version: 2,
    assessment_id: "t",
    persona: {
      id: "p",
      slug: "maya",
      display_name: "Maya",
      avatar_id: "a1",
    },
    primary_diagnosis: {
      id: "d",
      slug: partial.slug,
      name: partial.slug,
      dsm5_code: null,
      icd10_code: null,
      icd11_code: null,
    },
    comorbidities: [],
    difficulty: "intermediate",
    difficulty_modifiers: {} as CaseInstanceSnapshot["difficulty_modifiers"],
    therapy_modality: "cbt",
    therapy_reaction_rules: {},
    locale: "en-US",
    severity: partial.severity ?? "moderate",
    clinical_core: {
      disorder: partial.slug,
      age: 28,
      gender: "female",
      severity: partial.severity ?? "moderate",
      symptom_profile: [],
      disclosure_rules: [],
      session_goals: [],
      ideal_approach: "",
      risk_profile: {
        suicidal_ideation: partial.suicidal ?? "none",
      },
    },
    randomized_context: {} as CaseInstanceSnapshot["randomized_context"],
    memory_scope: "case_instance",
    generated_at: new Date().toISOString(),
  };
}

describe("pme UX cue adapter", () => {
  it("maps depression snapshot to slow/low cues without importing PME", () => {
    const cues = pmeUxCuesFromSession({
      avatar,
      clinicalSnapshot: snap({ slug: "mdd-recurrent-moderate" }),
    });
    expect(cues.pace).toBe("slow");
    expect(cues.energy).toBe("low");
    expect(cues.permitsVocalization).toBe(true);
  });

  it("suppresses vocalization for active high-risk plans", () => {
    const cues = pmeUxCuesFromSession({
      avatar,
      clinicalSnapshot: snap({
        slug: "mdd-recurrent-moderate",
        severity: "severe",
        suicidal: "active_with_plan",
      }),
    });
    expect(cues.permitsVocalization).toBe(false);
  });
});
