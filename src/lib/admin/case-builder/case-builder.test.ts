import { describe, expect, it } from "vitest";
import {
  customGoal,
  emptyGuidedDraft,
  findPresentationBySlug,
  guidedDraftToWriteInput,
  listLibrarySymptoms,
  listSessionGoals,
  listTrainingPresentations,
  THERAPY_FRAMEWORKS,
  validateAiSymptomSuggestions,
  validateGuidedDraft,
} from "@/lib/admin/case-builder";
import { assessDraftWrite } from "@/lib/admin/virtual-patient";

function approvedDraft() {
  const panic = findPresentationBySlug("panic-disorder");
  expect(panic).toBeTruthy();
  const draft = emptyGuidedDraft({
    presentationId: panic!.id,
    presentationSlug: panic!.slug,
    presentationName: panic!.name,
    dsm5Code: panic!.dsm5_code,
    icd11Code: panic!.icd11_code,
    profile: {
      displayName: "Sam Rivera",
      age: 28,
      gender: "female",
      occupation: "Graduate student",
      education: "University",
      relationshipStatus: "single",
      livingSituation: "dorm",
      culturalContext: "urban",
      city: "Boston",
      country: "United States",
    },
    goals: listSessionGoals().slice(0, 2),
    symptoms: (panic!.symptoms ?? []).slice(0, 2),
    contextNarrative:
      "Recently started university away from family. Increasing academic pressure.",
    structuredContextApproved: true,
    structuredContext: {
      education: "University student",
      stressors: ["Academic pressure", "Relocation"],
      familyHistory: "Maternal anxiety",
      previousTreatment: "None reported",
    },
    primaryFramework: "cbt",
    communicationStyle: "anxious",
    therapeuticChallenges: ["reassurance_seeking"],
    disclosureRules: panic!.disclosureRules,
    sectionApprovals: {
      presentation: true,
      profile: true,
      goals: true,
      symptoms: true,
      context: true,
      framework: true,
      interaction: true,
    },
  });
  return draft;
}

describe("Phase 9 case builder catalogues", () => {
  it("lists active training presentations from Case Engine packages", () => {
    const list = listTrainingPresentations();
    expect(list.length).toBeGreaterThanOrEqual(11);
    expect(list.every((p) => p.taxonomy === "vpsych-case-engine")).toBe(true);
    expect(list.some((p) => p.slug === "panic-disorder")).toBe(true);
  });

  it("aggregates session goals and symptoms without inventing DSM text", () => {
    expect(listSessionGoals().length).toBeGreaterThan(10);
    expect(listLibrarySymptoms().length).toBeGreaterThan(10);
    expect(THERAPY_FRAMEWORKS.map((f) => f.modality)).toContain("cbt");
  });
});

describe("Phase 9 guided draft validation", () => {
  it("requires presentation, goals, symptoms, framework, and approvals for create", () => {
    const result = validateGuidedDraft(emptyGuidedDraft(), "create");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "presentation_required")).toBe(
      true,
    );
  });

  it("accepts a coherent approved draft", () => {
    const result = validateGuidedDraft(approvedDraft(), "create");
    expect(result.ok).toBe(true);
  });

  it("blocks real-identifier patterns", () => {
    const draft = approvedDraft();
    draft.profile.displayName = "Patient MRN 12345";
    const result = validateGuidedDraft(draft, "step");
    expect(result.issues.some((i) => i.code === "real_identifier_blocked")).toBe(
      true,
    );
  });

  it("marks custom goals", () => {
    const g = customGoal("Practice paced breathing coaching");
    expect(g.custom).toBe(true);
    expect(g.category).toBe("custom");
  });
});

describe("Phase 9 AI symptom suggestion validation", () => {
  it("rejects invalid shapes", () => {
    expect(validateAiSymptomSuggestions(null).ok).toBe(false);
    expect(validateAiSymptomSuggestions([{ id: "x" }]).ok).toBe(false);
  });

  it("accepts bounded valid suggestions", () => {
    const result = validateAiSymptomSuggestions([
      {
        id: "panic_attack",
        description: "Recurrent panic attacks",
        domain: "anxiety",
        salience: "presenting",
      },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("Phase 9 map to virtual patient write", () => {
  it("produces a draft-valid write input with training_simulation metadata", () => {
    const input = guidedDraftToWriteInput(approvedDraft());
    expect(input.clinical_core?.disorder).toBeTruthy();
    expect(input.persona?.default_disorder_slug).toBe("panic-disorder");
    expect(
      (input.ideal_guidelines as { case_type?: string } | undefined)?.case_type,
    ).toBe("training_simulation");
    expect(input.personalities?.["en-US"]?.persona_prompt).toMatch(/fictional/i);
    expect(input.personalities?.["ar-JO"]?.persona_prompt).not.toEqual(
      input.personalities?.["en-US"]?.persona_prompt,
    );
    const draftWrite = assessDraftWrite(input);
    expect(draftWrite.ok).toBe(true);
  });
});
