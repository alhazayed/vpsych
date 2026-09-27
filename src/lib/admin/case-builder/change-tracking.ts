/**
 * Phase 10C-2 — field-level change tracking for Guided Edit.
 * Only USER-APPROVED diffs are eligible for the merge PATCH.
 */

import type { GuidedCaseDraft } from "./draft";

export const GUIDED_EDITABLE_FIELDS = [
  "presentation",
  "profile",
  "goals",
  "symptoms",
  "framework",
  "interaction",
  "voice",
  "severity",
  "riskProfile",
  "disclosureRules",
  "context",
] as const;

export type GuidedEditableField = (typeof GUIDED_EDITABLE_FIELDS)[number];

/** Per-field status shown in the UI and Review Changes step. */
export type FieldChangeStatus =
  | "unchanged"
  | "changed"
  | "ai_suggested"
  | "user_approved";

/** Provenance recorded when a change is approved for save. */
export type FieldChangeSource =
  | "administrator"
  | "ai_suggestion_approved";

export type FieldChangeState = {
  status: FieldChangeStatus;
  source?: FieldChangeSource;
};

export type FieldReviewRow = {
  field: GuidedEditableField;
  status: FieldChangeStatus;
  source: FieldChangeSource | null;
  currentValue: string;
  newValue: string;
  changed: boolean;
};

export type GuidedChangeApprovals = Partial<
  Record<GuidedEditableField, FieldChangeState>
>;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = rec[k];
    return JSON.stringify(sorted);
  }
  return String(value);
}

export function summarizeGuidedField(
  field: GuidedEditableField,
  draft: GuidedCaseDraft,
): string {
  switch (field) {
    case "presentation":
      return [
        draft.presentationName ?? "",
        draft.presentationSlug ?? "",
        draft.dsm5Code ?? "",
        draft.icd11Code ?? "",
      ].join(" · ");
    case "profile":
      return [
        draft.profile.displayName,
        `age ${draft.profile.age}`,
        draft.profile.gender,
        draft.profile.occupation,
        draft.profile.city,
        draft.profile.country,
      ]
        .filter(Boolean)
        .join(" · ");
    case "goals":
      return draft.goals.map((g) => g.label).join("; ") || "(none)";
    case "symptoms":
      return (
        draft.symptoms.map((s) => s.description).join("; ") || "(none)"
      );
    case "framework":
      return [
        draft.primaryFramework ?? "",
        draft.supportingFrameworks.join(", "),
        draft.frameworkRationale,
      ]
        .filter(Boolean)
        .join(" · ");
    case "interaction":
      return [
        draft.communicationStyle ?? "",
        draft.therapeuticChallenges.join(", "),
      ]
        .filter(Boolean)
        .join(" · ");
    case "voice":
      return draft.voiceProfileId ?? "(none)";
    case "severity":
      return draft.severity;
    case "riskProfile":
      return stableStringify(draft.riskProfile);
    case "disclosureRules":
      return stableStringify(draft.disclosureRules);
    case "context":
      return [
        draft.contextNarrative.trim(),
        draft.structuredContextApproved
          ? stableStringify(draft.structuredContext)
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function fieldSnapshot(field: GuidedEditableField, draft: GuidedCaseDraft): string {
  switch (field) {
    case "presentation":
      return stableStringify({
        id: draft.presentationId,
        slug: draft.presentationSlug,
        name: draft.presentationName,
        dsm5: draft.dsm5Code,
        icd11: draft.icd11Code,
      });
    case "profile":
      return stableStringify(draft.profile);
    case "goals":
      return stableStringify(
        draft.goals.map((g) => ({
          label: g.label,
          custom: Boolean(g.custom),
          category: g.category,
        })),
      );
    case "symptoms":
      return stableStringify(
        draft.symptoms.map((s) => ({
          id: s.id,
          description: s.description,
          domain: s.domain,
          salience: s.salience,
        })),
      );
    case "framework":
      return stableStringify({
        primary: draft.primaryFramework,
        supporting: draft.supportingFrameworks,
        rationale: draft.frameworkRationale,
      });
    case "interaction":
      return stableStringify({
        style: draft.communicationStyle,
        challenges: [...draft.therapeuticChallenges].sort(),
      });
    case "voice":
      return draft.voiceProfileId ?? "";
    case "severity":
      return draft.severity;
    case "riskProfile":
      return stableStringify(draft.riskProfile);
    case "disclosureRules":
      return stableStringify(draft.disclosureRules);
    case "context":
      return stableStringify({
        narrative: draft.contextNarrative.trim(),
        structured: draft.structuredContextApproved
          ? draft.structuredContext
          : null,
      });
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

export function isGuidedFieldChanged(
  field: GuidedEditableField,
  baseline: GuidedCaseDraft,
  current: GuidedCaseDraft,
): boolean {
  return fieldSnapshot(field, baseline) !== fieldSnapshot(field, current);
}

export function listChangedGuidedFields(
  baseline: GuidedCaseDraft,
  current: GuidedCaseDraft,
): GuidedEditableField[] {
  return GUIDED_EDITABLE_FIELDS.filter((f) =>
    isGuidedFieldChanged(f, baseline, current),
  );
}

export function isGuidedDraftDirty(
  baseline: GuidedCaseDraft,
  current: GuidedCaseDraft,
): boolean {
  return listChangedGuidedFields(baseline, current).length > 0;
}

/**
 * Build Review Changes rows. Unchanged fields are listed with status UNCHANGED
 * so the UI can clearly distinguish them; only approved+changed are saveable.
 */
export function buildChangeReview(
  baseline: GuidedCaseDraft,
  current: GuidedCaseDraft,
  approvals: GuidedChangeApprovals,
): FieldReviewRow[] {
  return GUIDED_EDITABLE_FIELDS.map((field) => {
    const changed = isGuidedFieldChanged(field, baseline, current);
    const meta = approvals[field];
    let status: FieldChangeStatus = "unchanged";
    if (changed) {
      if (meta?.status === "user_approved") status = "user_approved";
      else if (meta?.status === "ai_suggested") status = "ai_suggested";
      else status = meta?.status === "changed" ? "changed" : "changed";
    } else if (meta?.status === "ai_suggested") {
      // Pending AI suggestion not yet applied to draft
      status = "ai_suggested";
    }
    return {
      field,
      status,
      source: meta?.source ?? null,
      currentValue: summarizeGuidedField(field, baseline),
      newValue: summarizeGuidedField(field, current),
      changed,
    };
  });
}

/** Fields that will be sent to the merge API (approved + actually different). */
export function listApprovedSaveFields(
  baseline: GuidedCaseDraft,
  current: GuidedCaseDraft,
  approvals: GuidedChangeApprovals,
): GuidedEditableField[] {
  return GUIDED_EDITABLE_FIELDS.filter((field) => {
    if (!isGuidedFieldChanged(field, baseline, current)) return false;
    return approvals[field]?.status === "user_approved";
  });
}

export function markFieldChanged(
  approvals: GuidedChangeApprovals,
  field: GuidedEditableField,
  source: FieldChangeSource = "administrator",
): GuidedChangeApprovals {
  return {
    ...approvals,
    [field]: { status: "changed", source },
  };
}

export function markFieldAiSuggested(
  approvals: GuidedChangeApprovals,
  field: GuidedEditableField,
): GuidedChangeApprovals {
  return {
    ...approvals,
    [field]: { status: "ai_suggested" },
  };
}

export function markFieldApproved(
  approvals: GuidedChangeApprovals,
  field: GuidedEditableField,
  source: FieldChangeSource = "administrator",
): GuidedChangeApprovals {
  return {
    ...approvals,
    [field]: { status: "user_approved", source },
  };
}

export function clearFieldApproval(
  approvals: GuidedChangeApprovals,
  field: GuidedEditableField,
): GuidedChangeApprovals {
  const next = { ...approvals };
  delete next[field];
  return next;
}
