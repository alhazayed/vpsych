import type { VirtualPatientDraft, VirtualPatientLifecycle } from "./types";

export type DraftValidation = {
  ok: boolean;
  errors: string[];
  checks: {
    clinical: boolean;
    behavior: boolean;
    voice: boolean;
    training: boolean;
    safety: boolean;
  };
};

export function validateVirtualPatientDraft(
  draft: VirtualPatientDraft,
): DraftValidation {
  const errors: string[] = [];

  if (!draft.displayName.trim()) errors.push("Display name is required.");
  if (!Number.isFinite(draft.age) || draft.age < 12 || draft.age > 100) {
    errors.push("Age must be between 12 and 100.");
  }
  if (!draft.primaryDiagnosis.trim()) {
    errors.push("Primary diagnosis is required.");
  }
  if (!draft.presentingComplaint.trim()) {
    errors.push("Presenting complaint is required.");
  }
  if (!draft.dialect.trim()) errors.push("Dialect is required.");
  if (draft.behaviorRules.length === 0) {
    errors.push("At least one behavior rule is required.");
  }
  if (draft.targetCompetencies.length === 0) {
    errors.push("Select at least one training competency.");
  }
  if (
    !Number.isFinite(draft.expectedSessionMinutes) ||
    draft.expectedSessionMinutes < 10 ||
    draft.expectedSessionMinutes > 90
  ) {
    errors.push("Expected session duration must be 10–90 minutes.");
  }

  const clinical =
    Boolean(draft.primaryDiagnosis.trim()) &&
    Boolean(draft.presentingComplaint.trim()) &&
    draft.age >= 12;
  const behavior = draft.behaviorRules.length > 0;
  const voice = true; // voice optional until publish; preview still allowed
  const training = draft.targetCompetencies.length > 0;
  const safety = draft.behaviorRules.some(
    (r) => r.trigger === "asked_about_suicide",
  );

  if (!safety) {
    errors.push(
      "Include a suicide-assessment behavior rule for safety configuration.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    checks: { clinical, behavior, voice, training, safety },
  };
}

export function canTransitionLifecycle(
  from: VirtualPatientLifecycle,
  to: VirtualPatientLifecycle,
): boolean {
  if (from === to) return true;
  const allowed: Record<VirtualPatientLifecycle, VirtualPatientLifecycle[]> = {
    draft: ["testing", "published", "archived"],
    testing: ["draft", "published", "archived"],
    published: ["archived"], // published is immutable; edits create a new draft via duplicate
    archived: ["draft"],
  };
  return allowed[from].includes(to);
}
