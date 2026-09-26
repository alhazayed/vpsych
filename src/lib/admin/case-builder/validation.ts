import type { GuidedCaseDraft } from "./draft";
import { findPresentationById } from "./catalogues";
import { THERAPY_FRAMEWORKS } from "./catalogues";

export type GuidedIssue = {
  code: string;
  message: string;
  step?: GuidedCaseDraft["step"];
  severity: "error" | "warning";
};

export type GuidedValidationResult = {
  ok: boolean;
  issues: GuidedIssue[];
};

function err(
  code: string,
  message: string,
  step?: GuidedCaseDraft["step"],
): GuidedIssue {
  return { code, message, step, severity: "error" };
}

function warn(
  code: string,
  message: string,
  step?: GuidedCaseDraft["step"],
): GuidedIssue {
  return { code, message, step, severity: "warning" };
}

/** Validate draft for advancing past a step or creating a training patient. */
export function validateGuidedDraft(
  draft: GuidedCaseDraft,
  mode: "step" | "create" = "create",
): GuidedValidationResult {
  const issues: GuidedIssue[] = [];

  if (!draft.presentationId || !draft.presentationSlug) {
    issues.push(
      err(
        "presentation_required",
        "Select a clinical presentation / training diagnosis.",
        "presentation",
      ),
    );
  } else {
    const p = findPresentationById(draft.presentationId);
    if (!p) {
      issues.push(
        err(
          "presentation_unknown",
          "Selected presentation is not in the training catalogue.",
          "presentation",
        ),
      );
    } else {
      if (p.min_age != null && draft.profile.age < p.min_age) {
        issues.push(
          err(
            "age_below_min",
            `Age is below the minimum for this presentation (${p.min_age}).`,
            "profile",
          ),
        );
      }
      if (p.max_age != null && draft.profile.age > p.max_age) {
        issues.push(
          err(
            "age_above_max",
            `Age is above the maximum for this presentation (${p.max_age}).`,
            "profile",
          ),
        );
      }
    }
  }

  if (!draft.profile.displayName.trim()) {
    issues.push(
      err("display_name_required", "Enter a fictional patient name.", "profile"),
    );
  }
  if (
    !Number.isFinite(draft.profile.age) ||
    draft.profile.age < 12 ||
    draft.profile.age > 100
  ) {
    issues.push(
      err("age_invalid", "Enter a valid age between 12 and 100.", "profile"),
    );
  }

  const forbiddenIdPattern =
    /\b(ssn|national\s*id|mrn|medical\s*record|passport|phone|email@)\b/i;
  const identityBlob = [
    draft.profile.displayName,
    draft.contextNarrative,
    draft.generated?.presentingComplaint,
  ]
    .filter(Boolean)
    .join(" ");
  if (forbiddenIdPattern.test(identityBlob)) {
    issues.push(
      err(
        "real_identifier_blocked",
        "Remove real-world identifiers. Training cases must stay fictional.",
        "profile",
      ),
    );
  }

  if (draft.goals.length < 1) {
    issues.push(
      err(
        "goals_required",
        "Select at least one session goal for the trainee.",
        "goals",
      ),
    );
  }

  if (draft.symptoms.length < 1) {
    issues.push(
      err(
        "symptoms_required",
        "Add at least one symptom to the training case.",
        "symptoms",
      ),
    );
  }

  if (!draft.contextNarrative.trim() && !draft.structuredContextApproved) {
    issues.push(
      err(
        "context_required",
        "Describe what is happening in this patient's life, or approve structured context.",
        "context",
      ),
    );
  }

  if (!draft.primaryFramework) {
    issues.push(
      err(
        "framework_required",
        "Select a primary therapeutic framework.",
        "framework",
      ),
    );
  } else if (
    !THERAPY_FRAMEWORKS.some((f) => f.modality === draft.primaryFramework)
  ) {
    issues.push(
      err(
        "framework_unknown",
        "Primary framework must be from the controlled library.",
        "framework",
      ),
    );
  }

  if (!draft.communicationStyle) {
    issues.push(
      err(
        "communication_required",
        "Select a communication style.",
        "interaction",
      ),
    );
  }

  if (mode === "create") {
    const requiredApprovals: Array<keyof GuidedCaseDraft["sectionApprovals"]> =
      [
        "presentation",
        "profile",
        "goals",
        "symptoms",
        "context",
        "framework",
        "interaction",
      ];
    for (const key of requiredApprovals) {
      if (!draft.sectionApprovals[key]) {
        issues.push(
          err(
            `approve_${key}`,
            `Approve the ${key} section before creating the training patient.`,
            "review",
          ),
        );
      }
    }
    if (draft.generated && !draft.sectionApprovals.generated) {
      issues.push(
        warn(
          "generated_unapproved",
          "Generated narrative is present but not approved — it will be omitted from the draft.",
          "review",
        ),
      );
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  return { ok: errors.length === 0, issues };
}

export function validateAiSymptomSuggestions(
  items: unknown,
): { ok: true; symptoms: GuidedCaseDraft["symptoms"] } | { ok: false; error: string } {
  if (!Array.isArray(items)) {
    return { ok: false, error: "AI symptoms must be an array." };
  }
  const symptoms: GuidedCaseDraft["symptoms"] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Invalid symptom suggestion shape." };
    }
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const description =
      typeof o.description === "string" ? o.description.trim() : "";
    if (!id || !description) {
      return { ok: false, error: "Each symptom needs id and description." };
    }
    if (description.length > 280) {
      return { ok: false, error: "Symptom description too long." };
    }
    const domain =
      typeof o.domain === "string"
        ? (o.domain as GuidedCaseDraft["symptoms"][number]["domain"])
        : undefined;
    const salience =
      typeof o.salience === "string"
        ? (o.salience as GuidedCaseDraft["symptoms"][number]["salience"])
        : "elicited";
    symptoms.push({ id, description, domain, salience });
  }
  if (symptoms.length === 0) {
    return { ok: false, error: "AI returned no symptoms." };
  }
  if (symptoms.length > 20) {
    return { ok: false, error: "Too many AI symptom suggestions." };
  }
  return { ok: true, symptoms };
}
