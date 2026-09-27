/**
 * Phase 10C-2 — merge Guided Edit approvals into a partial VirtualPatientWriteInput.
 *
 * CRITICAL: only approved fields are written. Omitted top-level keys are preserved
 * by admin_update_virtual_patient key-presence semantics (Phase 10C-1).
 *
 * Arabic personality / human_personality.ar-JO are never rewritten by English
 * Guided Edit. Stub AR remains stub; authored AR remains authored.
 */

import type { VirtualPatientWriteInput } from "@/lib/admin/virtual-patient/validation";
import type {
  Avatar,
  AvatarPersonality,
  ClinicalCore,
} from "@/lib/types";
import { findPresentationById } from "./catalogues";
import type {
  FieldChangeSource,
  GuidedEditableField,
} from "./change-tracking";
import { listApprovedSaveFields, type GuidedChangeApprovals } from "./change-tracking";
import type { GuidedCaseDraft } from "./draft";
import { detectArabicAuthorship } from "./avatar-to-guided";

export type GuidedMergeResult =
  | {
      ok: true;
      input: VirtualPatientWriteInput;
      appliedFields: GuidedEditableField[];
      noop: boolean;
      arabicAuthorship: ReturnType<typeof detectArabicAuthorship>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

function asGuidelines(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function cloneCore(core: ClinicalCore | null | undefined): ClinicalCore | null {
  if (!core) return null;
  return structuredClone(core);
}

function clonePersonalities(
  personalities: Avatar["personalities"],
): NonNullable<Avatar["personalities"]> {
  if (!personalities || typeof personalities !== "object") return {};
  return structuredClone(personalities);
}

function approachFromDraft(draft: GuidedCaseDraft): string {
  const parts = [
    draft.primaryFramework
      ? `Primary training framework: ${draft.primaryFramework}.`
      : "",
    draft.supportingFrameworks.length
      ? `Supporting: ${draft.supportingFrameworks.join(", ")}.`
      : "",
    draft.frameworkRationale.trim(),
  ].filter(Boolean);
  return parts.join(" ") || "Supportive collaborative interview.";
}

function patchEnIdentity(
  en: AvatarPersonality,
  draft: GuidedCaseDraft,
): AvatarPersonality {
  const next = structuredClone(en);
  next.identity = {
    ...next.identity,
    display_name: draft.profile.displayName.trim() || next.identity.display_name,
    occupation: draft.profile.occupation.trim() || next.identity.occupation,
    education: draft.profile.education.trim() || next.identity.education,
    living_situation:
      draft.profile.livingSituation.trim() || next.identity.living_situation,
    socioeconomic_context:
      draft.profile.culturalContext.trim() ||
      next.identity.socioeconomic_context,
    city: draft.profile.city.trim() || next.identity.city,
    country: draft.profile.country.trim() || next.identity.country,
  };
  return next;
}

function appendEnContext(
  en: AvatarPersonality,
  draft: GuidedCaseDraft,
): AvatarPersonality {
  const next = structuredClone(en);
  const bits = [
    draft.contextNarrative.trim(),
    draft.structuredContextApproved && draft.structuredContext
      ? [
          draft.structuredContext.education &&
            `Education: ${draft.structuredContext.education}`,
          draft.structuredContext.stressors?.length
            ? `Stressors: ${draft.structuredContext.stressors.join("; ")}`
            : "",
          draft.structuredContext.familyHistory &&
            `Family history: ${draft.structuredContext.familyHistory}`,
          draft.structuredContext.previousTreatment &&
            `Previous treatment: ${draft.structuredContext.previousTreatment}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!bits) return next;
  const marker = "<!-- guided-edit-context -->";
  const prompt = next.persona_prompt ?? "";
  const stripped = prompt.includes(marker)
    ? prompt.slice(0, prompt.indexOf(marker)).trimEnd()
    : prompt.trimEnd();
  next.persona_prompt = `${stripped}\n\n${marker}\n${bits}`;
  return next;
}

/**
 * Build a partial write input from approved Guided Edit fields.
 * Never reconstructs the full Virtual Patient from the draft alone.
 */
export function buildGuidedMergeWriteInput(opts: {
  existing: Avatar;
  existingPersona?: {
    default_disorder_id?: string | null;
    default_disorder_slug?: string | null;
    display_name?: string | null;
    slug?: string | null;
    identity?: Record<string, unknown> | null;
  } | null;
  baseline: GuidedCaseDraft;
  draft: GuidedCaseDraft;
  approvals: GuidedChangeApprovals;
  /** Optional explicit list; defaults to approved+changed vs baseline. */
  approvedFields?: GuidedEditableField[];
}): GuidedMergeResult {
  const { existing, existingPersona, baseline, draft, approvals } = opts;
  const arabicAuthorship = detectArabicAuthorship(existing.personalities);

  const approved =
    opts.approvedFields ??
    listApprovedSaveFields(baseline, draft, approvals);

  if (approved.length === 0) {
    return {
      ok: true,
      input: { slug: existing.slug ?? draft.slug },
      appliedFields: [],
      noop: true,
      arabicAuthorship,
    };
  }

  // Reject unknown presentation when presentation itself is being changed.
  if (approved.includes("presentation")) {
    if (!draft.presentationId) {
      return {
        ok: false,
        status: 400,
        error: "Presentation is required when changing clinical presentation.",
        code: "presentation_required",
      };
    }
    const p = findPresentationById(draft.presentationId);
    if (!p) {
      return {
        ok: false,
        status: 400,
        error:
          "Selected presentation is not in the training catalogue. Requires case authoring.",
        code: "presentation_unknown",
      };
    }
  }

  const input: VirtualPatientWriteInput = {
    slug: existing.slug ?? draft.slug,
  };

  const touchesCore = approved.some((f) =>
    [
      "presentation",
      "profile",
      "goals",
      "symptoms",
      "framework",
      "severity",
      "riskProfile",
      "disclosureRules",
    ].includes(f),
  );

  let core = cloneCore(existing.clinical_core);
  if (touchesCore) {
    if (!core) {
      core = {
        disorder: draft.presentationName || existing.disorder || "Training presentation",
        age: draft.profile.age,
        gender: draft.profile.gender,
        symptom_profile: draft.symptoms,
        disclosure_rules: draft.disclosureRules.length
          ? draft.disclosureRules
          : [{ topic: "presenting concerns", condition: "volunteered" }],
        session_goals: draft.goals.map((g) =>
          g.custom ? `[custom] ${g.label}` : g.label,
        ),
        ideal_approach: approachFromDraft(draft),
        risk_profile: draft.riskProfile,
        severity: draft.severity,
      };
    } else {
      if (approved.includes("presentation")) {
        core.disorder =
          draft.presentationName || core.disorder || "Training presentation";
        core.dsm5_code = draft.dsm5Code ?? core.dsm5_code;
        core.icd11_code = draft.icd11Code ?? core.icd11_code;
      }
      if (approved.includes("profile")) {
        core.age = draft.profile.age;
        core.gender = draft.profile.gender;
      }
      if (approved.includes("goals")) {
        core.session_goals = draft.goals.map((g) =>
          g.custom ? `[custom] ${g.label}` : g.label,
        );
      }
      if (approved.includes("symptoms")) {
        core.symptom_profile = draft.symptoms;
      }
      if (approved.includes("framework")) {
        core.ideal_approach = approachFromDraft(draft);
      }
      if (approved.includes("severity")) {
        core.severity = draft.severity;
      }
      if (approved.includes("riskProfile")) {
        core.risk_profile = draft.riskProfile;
      }
      if (approved.includes("disclosureRules")) {
        core.disclosure_rules = draft.disclosureRules;
      }
      // Preserve case_file, mse, formulation, protective_factors, onset_duration
      // by cloning existing first — never drop Stage 6 extensions.
    }
    input.clinical_core = core;
  }

  const touchesGuidelines = approved.some((f) =>
    ["framework", "interaction", "goals"].includes(f),
  );
  if (touchesGuidelines) {
    const guidelines = asGuidelines(existing.ideal_guidelines);
    if (approved.includes("framework")) {
      guidelines.primary_framework = draft.primaryFramework;
      guidelines.supporting_frameworks = draft.supportingFrameworks;
      guidelines.framework_rationale = draft.frameworkRationale;
      guidelines.ideal_approach = approachFromDraft(draft);
    }
    if (approved.includes("interaction")) {
      guidelines.communication_style = draft.communicationStyle;
      guidelines.therapeutic_challenges = draft.therapeuticChallenges;
    }
    if (approved.includes("goals") && core) {
      guidelines.session_goals = core.session_goals;
    }
    // Preserve case_type and any educator custom keys.
    if (guidelines.case_type == null) {
      guidelines.case_type = "training_simulation";
    }
    input.ideal_guidelines = guidelines;
  }

  const touchesEnPersonality = approved.some((f) =>
    ["profile", "context", "presentation"].includes(f),
  );
  if (touchesEnPersonality) {
    const personalities = clonePersonalities(existing.personalities);
    const en = personalities["en-US"] as AvatarPersonality | undefined;
    if (!en) {
      return {
        ok: false,
        status: 400,
        error: "Existing English personality is missing; cannot merge profile edits.",
        code: "en_personality_missing",
      };
    }
    let nextEn = en;
    if (approved.includes("profile")) {
      nextEn = patchEnIdentity(nextEn, draft);
    }
    if (approved.includes("context")) {
      nextEn = appendEnContext(nextEn, draft);
    }
    if (approved.includes("presentation") && draft.presentationName) {
      // Soft touch: do not rewrite the full prompt; leave authored EN prompt.
      // Disorder rename lives in clinical_core.
      void draft.presentationName;
    }
    personalities["en-US"] = nextEn;

    // Hard invariant: Arabic must be byte-stable relative to existing.
    const arExisting = existing.personalities?.["ar-JO"];
    if (arExisting) {
      personalities["ar-JO"] = structuredClone(arExisting);
    } else {
      delete personalities["ar-JO"];
    }

    input.personalities = personalities;
    // Never send human_personality — omit so EN/AR HP columns are preserved.
  }

  if (approved.includes("voice")) {
    input.voice_profile_id = draft.voiceProfileId;
  }

  // Persona link updates only when presentation or profile display name changes.
  if (
    approved.includes("presentation") ||
    approved.includes("profile")
  ) {
    input.persona = {
      create: true,
      default_disorder_id: approved.includes("presentation")
        ? draft.presentationId
        : (existingPersona?.default_disorder_id ?? null),
      default_disorder_slug: approved.includes("presentation")
        ? draft.presentationSlug
        : (existingPersona?.default_disorder_slug ?? null),
      display_name: approved.includes("profile")
        ? draft.profile.displayName.trim()
        : (existingPersona?.display_name ?? undefined),
      slug: existingPersona?.slug ?? existing.slug ?? undefined,
      identity: {
        ...(existingPersona?.identity ?? {}),
        ...(approved.includes("profile")
          ? {
              age: draft.profile.age,
              gender: draft.profile.gender,
              occupation_baseline: draft.profile.occupation || undefined,
              education_baseline: draft.profile.education || undefined,
              culture_baseline: draft.profile.culturalContext || undefined,
            }
          : {}),
        ...(approved.includes("interaction")
          ? { communication_style: draft.communicationStyle ?? undefined }
          : {}),
      },
    };
  } else if (approved.includes("interaction")) {
    input.persona = {
      create: true,
      default_disorder_id: existingPersona?.default_disorder_id ?? null,
      default_disorder_slug: existingPersona?.default_disorder_slug ?? null,
      display_name: existingPersona?.display_name ?? undefined,
      slug: existingPersona?.slug ?? existing.slug ?? undefined,
      identity: {
        ...(existingPersona?.identity ?? {}),
        communication_style: draft.communicationStyle ?? undefined,
      },
    };
  }

  return {
    ok: true,
    input,
    appliedFields: approved,
    noop: false,
    arabicAuthorship,
  };
}

export function changeSourcesForAudit(
  approvals: GuidedChangeApprovals,
  fields: GuidedEditableField[],
): Record<string, FieldChangeSource | undefined> {
  const out: Record<string, FieldChangeSource | undefined> = {};
  for (const f of fields) {
    out[f] = approvals[f]?.source;
  }
  return out;
}
