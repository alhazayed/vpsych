import { describe, expect, it } from "vitest";
import type { Avatar } from "@/lib/types";
import {
  DEFAULT_VIRTUAL_PATIENT_DRAFT,
  avatarToDraft,
  canTransitionLifecycle,
  draftToAvatarRow,
  readLifecycle,
  toListItem,
  validateVirtualPatientDraft,
} from "@/lib/admin/virtual-patients";

function sampleDraft() {
  return {
    ...DEFAULT_VIRTUAL_PATIENT_DRAFT,
    displayName: "Sam Rivera",
    age: 34,
    gender: "female" as const,
    occupation: "Teacher",
    primaryDiagnosis: "Generalized Anxiety Disorder",
    presentingComplaint: "Constant worry and insomnia",
    clinicalHistory: "Symptoms for 14 months",
  };
}

describe("virtual patient validation", () => {
  it("rejects incomplete drafts", () => {
    const result = validateVirtualPatientDraft(DEFAULT_VIRTUAL_PATIENT_DRAFT);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts a complete draft with suicide behavior rule", () => {
    const result = validateVirtualPatientDraft(sampleDraft());
    expect(result.ok).toBe(true);
    expect(result.checks.clinical).toBe(true);
    expect(result.checks.behavior).toBe(true);
    expect(result.checks.safety).toBe(true);
    expect(result.checks.training).toBe(true);
  });
});

describe("virtual patient lifecycle transitions", () => {
  it("allows draft → testing → published → archived", () => {
    expect(canTransitionLifecycle("draft", "testing")).toBe(true);
    expect(canTransitionLifecycle("testing", "published")).toBe(true);
    expect(canTransitionLifecycle("published", "archived")).toBe(true);
  });

  it("blocks destructive edit of published (no published → draft)", () => {
    expect(canTransitionLifecycle("published", "draft")).toBe(false);
    expect(canTransitionLifecycle("published", "testing")).toBe(false);
  });
});

describe("virtual patient mapping", () => {
  it("maps draft to avatar row without exposing raw wizard JSON as persona", () => {
    const row = draftToAvatarRow(sampleDraft());
    expect(row.name).toBe("Sam Rivera");
    expect(row.disorder).toBe("Generalized Anxiety Disorder");
    expect(row.lifecycle_status).toBe("draft");
    expect(row.schema_version).toBe(2);
    expect(row.clinical_core).toMatchObject({
      disorder: "Generalized Anxiety Disorder",
      age: 34,
    });
    const personalities = row.personalities as Record<string, { persona_prompt: string }>;
    expect(personalities["en-US"]?.persona_prompt).toContain("Sam Rivera");
    expect(personalities["en-US"]?.persona_prompt).not.toContain('"traits"');
  });

  it("round-trips list item status from lifecycle_status", () => {
    const row = draftToAvatarRow({
      ...sampleDraft(),
      lifecycleStatus: "testing",
    });
    const avatar = {
      id: "00000000-0000-4000-8000-000000000001",
      ...row,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Avatar;
    expect(readLifecycle(avatar)).toBe("testing");
    expect(toListItem(avatar).status).toBe("testing");
    expect(toListItem(avatar).displayName).toBe("Sam Rivera");
  });

  it("avatarToDraft restores admin-authored fields", () => {
    const row = draftToAvatarRow(sampleDraft());
    const avatar = {
      id: "00000000-0000-4000-8000-000000000002",
      ...row,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Avatar;
    const draft = avatarToDraft(avatar);
    expect(draft.displayName).toBe("Sam Rivera");
    expect(draft.primaryDiagnosis).toBe("Generalized Anxiety Disorder");
    expect(draft.behaviorRules.length).toBeGreaterThan(0);
    expect(draft.targetCompetencies.length).toBeGreaterThan(0);
  });
});
