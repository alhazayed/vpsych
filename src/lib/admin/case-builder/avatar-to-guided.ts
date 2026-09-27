/**
 * Phase 10C-2 — map a persisted Virtual Patient into GuidedCaseDraft.
 * Does not invent clinical content; missing fields stay empty/null.
 */

import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import type { TherapyModality } from "@/lib/case-engine/types";
import { isArabicPersonalityStub } from "@/lib/admin/virtual-patient/validation";
import {
  COMMUNICATION_STYLES,
  CURATED_SESSION_GOALS,
  THERAPEUTIC_CHALLENGES,
  THERAPY_FRAMEWORKS,
  findPresentationById,
  findPresentationBySlug,
  listTrainingPresentations,
  type CommunicationStyle,
  type SessionGoalItem,
  type TherapeuticChallenge,
} from "./catalogues";
import { emptyGuidedDraft, type GuidedCaseDraft } from "./draft";

export type ArabicAuthorshipState = "missing" | "stub" | "authored";

export type AvatarToGuidedResult = {
  draft: GuidedCaseDraft;
  arabicAuthorship: ArabicAuthorshipState;
  /** True when presentation could not be matched to the training catalogue. */
  presentationUnresolved: boolean;
};

const FRAMEWORK_IDS = new Set(THERAPY_FRAMEWORKS.map((f) => f.modality));
const COMM_IDS = new Set<string>(COMMUNICATION_STYLES);
const CHALLENGE_IDS = new Set<string>(THERAPEUTIC_CHALLENGES);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readGuidelines(avatar: Avatar): Record<string, unknown> {
  return asRecord(avatar.ideal_guidelines) ?? {};
}

function matchPresentation(
  avatar: Avatar,
  persona?: { default_disorder_id?: string | null; default_disorder_slug?: string | null } | null,
): {
  presentationId: string | null;
  presentationSlug: string | null;
  presentationName: string | null;
  dsm5Code: string | null;
  icd11Code: string | null;
  unresolved: boolean;
} {
  if (persona?.default_disorder_id) {
    const byId = findPresentationById(persona.default_disorder_id);
    if (byId) {
      return {
        presentationId: byId.id,
        presentationSlug: byId.slug,
        presentationName: byId.name,
        dsm5Code: byId.dsm5_code,
        icd11Code: byId.icd11_code,
        unresolved: false,
      };
    }
  }
  const slug = persona?.default_disorder_slug?.trim();
  if (slug) {
    const bySlug = findPresentationBySlug(slug);
    if (bySlug) {
      return {
        presentationId: bySlug.id,
        presentationSlug: bySlug.slug,
        presentationName: bySlug.name,
        dsm5Code: bySlug.dsm5_code,
        icd11Code: bySlug.icd11_code,
        unresolved: false,
      };
    }
  }
  const core = avatar.clinical_core;
  const disorderName = (core?.disorder || avatar.disorder || "").trim();
  if (disorderName) {
    const byName = listTrainingPresentations().find(
      (p) => p.name.toLowerCase() === disorderName.toLowerCase(),
    );
    if (byName) {
      return {
        presentationId: byName.id,
        presentationSlug: byName.slug,
        presentationName: byName.name,
        dsm5Code: byName.dsm5_code ?? core?.dsm5_code ?? null,
        icd11Code: byName.icd11_code ?? core?.icd11_code ?? null,
        unresolved: false,
      };
    }
  }
  return {
    presentationId: persona?.default_disorder_id ?? null,
    presentationSlug: slug ?? null,
    presentationName: disorderName || null,
    dsm5Code: core?.dsm5_code ?? null,
    icd11Code: core?.icd11_code ?? null,
    unresolved: Boolean(disorderName || persona?.default_disorder_id),
  };
}

function goalsFromClinical(core: ClinicalCore | null | undefined): SessionGoalItem[] {
  const labels = core?.session_goals ?? [];
  return labels.map((label, i) => {
    const custom = label.startsWith("[custom] ");
    const clean = custom ? label.slice("[custom] ".length) : label;
    const curated = CURATED_SESSION_GOALS.find(
      (g) => g.label.toLowerCase() === clean.toLowerCase(),
    );
    if (curated && !custom) return { ...curated };
    return {
      id: `loaded-goal-${i}`,
      label: clean,
      category: "custom" as const,
      custom: true,
    };
  });
}

function parseFramework(guidelines: Record<string, unknown>, approach: string): {
  primary: TherapyModality | null;
  supporting: TherapyModality[];
  rationale: string;
} {
  const primaryRaw = guidelines.primary_framework;
  const primary =
    typeof primaryRaw === "string" && FRAMEWORK_IDS.has(primaryRaw as TherapyModality)
      ? (primaryRaw as TherapyModality)
      : null;
  const supportingRaw = guidelines.supporting_frameworks;
  const supporting = Array.isArray(supportingRaw)
    ? supportingRaw.filter(
        (x): x is TherapyModality =>
          typeof x === "string" && FRAMEWORK_IDS.has(x as TherapyModality),
      )
    : [];
  let rationale = "";
  if (typeof guidelines.framework_rationale === "string") {
    rationale = guidelines.framework_rationale;
  } else if (approach) {
    // Prefer not inventing — leave rationale empty unless we stored it.
    const stripped = approach
      .replace(/Primary training framework:\s*[^.]+\.?/gi, "")
      .replace(/Supporting:\s*[^.]+\.?/gi, "")
      .trim();
    rationale = stripped;
  }
  if (!primary && approach) {
    for (const f of THERAPY_FRAMEWORKS) {
      if (approach.toLowerCase().includes(f.modality)) {
        return { primary: f.modality, supporting, rationale };
      }
    }
  }
  return { primary, supporting, rationale };
}

function parseInteraction(guidelines: Record<string, unknown>): {
  communicationStyle: CommunicationStyle | null;
  therapeuticChallenges: TherapeuticChallenge[];
} {
  const styleRaw = guidelines.communication_style;
  const communicationStyle =
    typeof styleRaw === "string" && COMM_IDS.has(styleRaw as CommunicationStyle)
      ? (styleRaw as CommunicationStyle)
      : null;
  const challengesRaw = guidelines.therapeutic_challenges;
  const therapeuticChallenges = Array.isArray(challengesRaw)
    ? challengesRaw.filter(
        (x): x is TherapeuticChallenge =>
          typeof x === "string" && CHALLENGE_IDS.has(x as TherapeuticChallenge),
      )
    : [];
  return { communicationStyle, therapeuticChallenges };
}

export function detectArabicAuthorship(
  personalities: Avatar["personalities"],
): ArabicAuthorshipState {
  const ar = personalities?.["ar-JO"];
  if (!ar || typeof ar !== "object") return "missing";
  if (isArabicPersonalityStub(personalities)) return "stub";
  const p = ar as AvatarPersonality;
  const name = p.identity?.display_name?.trim() ?? "";
  const prompt = p.persona_prompt?.trim() ?? "";
  if (!name && !prompt) return "missing";
  return "authored";
}

/**
 * Map persisted avatar (+ optional persona link) into Guided draft state.
 */
export function avatarToGuidedDraft(
  avatar: Avatar,
  persona?: {
    default_disorder_id?: string | null;
    default_disorder_slug?: string | null;
  } | null,
): AvatarToGuidedResult {
  const core = avatar.clinical_core ?? null;
  const en = avatar.personalities?.["en-US"] as AvatarPersonality | undefined;
  const guidelines = readGuidelines(avatar);
  const presentation = matchPresentation(avatar, persona);
  const framework = parseFramework(guidelines, core?.ideal_approach ?? "");
  const interaction = parseInteraction(guidelines);
  const identity = en?.identity;

  const gender = core?.gender ?? "unspecified";
  const age =
    typeof core?.age === "number" && Number.isFinite(core.age)
      ? core.age
      : typeof avatar.age === "number"
        ? avatar.age
        : 28;

  const draft = emptyGuidedDraft({
    mode: "edit",
    step: "presentation",
    avatarId: avatar.id,
    slug: avatar.slug ?? "",
    voiceProfileId: avatar.voice_profile_id ?? null,
    presentationId: presentation.presentationId,
    presentationSlug: presentation.presentationSlug,
    presentationName: presentation.presentationName,
    dsm5Code: presentation.dsm5Code,
    icd11Code: presentation.icd11Code,
    profile: {
      displayName:
        identity?.display_name?.trim() ||
        avatar.name?.trim() ||
        "",
      age,
      gender,
      occupation: identity?.occupation ?? "",
      education: identity?.education ?? "",
      relationshipStatus: "",
      livingSituation: identity?.living_situation ?? "",
      culturalContext: identity?.socioeconomic_context ?? "",
      city: identity?.city ?? "",
      country: identity?.country ?? "",
    },
    goals: goalsFromClinical(core),
    symptoms: [...(core?.symptom_profile ?? [])],
    disclosureRules: [...(core?.disclosure_rules ?? [])],
    riskProfile: core?.risk_profile ?? { suicidal_ideation: "none" },
    severity: core?.severity ?? "moderate",
    primaryFramework: framework.primary,
    supportingFrameworks: framework.supporting,
    frameworkRationale: framework.rationale,
    communicationStyle: interaction.communicationStyle,
    therapeuticChallenges: interaction.therapeuticChallenges,
    contextNarrative: "",
    structuredContext: null,
    structuredContextApproved: false,
    generated: null,
    sectionApprovals: {
      presentation: Boolean(presentation.presentationId),
      profile: Boolean(identity?.display_name || avatar.name),
      goals: (core?.session_goals?.length ?? 0) > 0,
      symptoms: (core?.symptom_profile?.length ?? 0) > 0,
      context: true,
      framework: Boolean(framework.primary || core?.ideal_approach),
      interaction: Boolean(
        interaction.communicationStyle ||
          interaction.therapeuticChallenges.length,
      ),
    },
    aiSymptomSuggestions: [],
    customGoalDraft: "",
    lastError: null,
  });

  const idKnown = presentation.presentationId
    ? Boolean(findPresentationById(presentation.presentationId))
    : false;

  return {
    draft,
    arabicAuthorship: detectArabicAuthorship(avatar.personalities),
    presentationUnresolved: presentation.unresolved && !idKnown,
  };
}
