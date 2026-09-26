/**
 * Phase 9 Guided Case Builder — client/server draft state (educational).
 */

import type { TherapyModality } from "@/lib/case-engine/types";
import type {
  ClinicalCore,
  DisclosureRule,
  RiskProfile,
  SymptomProfileItem,
} from "@/lib/types";
import type {
  CommunicationStyle,
  GoalCategoryId,
  SessionGoalItem,
  TherapeuticChallenge,
} from "./catalogues";

export const GUIDED_STEPS = [
  "presentation",
  "profile",
  "goals",
  "symptoms",
  "context",
  "framework",
  "interaction",
  "generate",
  "review",
  "create",
] as const;

export type GuidedStepId = (typeof GUIDED_STEPS)[number];

export type StructuredContext = {
  education?: string;
  stressors: string[];
  familyHistory?: string;
  previousTreatment?: string;
  medications?: string;
  medicalHistory?: string;
  occupation?: string;
  livingSituation?: string;
};

export type GeneratedCaseBundle = {
  presentingComplaint?: string;
  historyNarrative?: string;
  symptomNarrative?: string;
  timeline?: string;
  psychosocialContext?: string;
  medicalHistory?: string;
  psychiatricHistory?: string;
  familyHistory?: string;
  substanceContext?: string;
  mentalStatePresentation?: string;
  riskNarrative?: string;
  sessionBehaviour?: string;
  expectedTherapeuticResponses?: string;
  hiddenInformationNotes?: string;
  personaPromptEn?: string;
  displayNameEn?: string;
  cityEn?: string;
  countryEn?: string;
  occupationEn?: string;
};

export type SectionApprovalKey =
  | "presentation"
  | "profile"
  | "goals"
  | "symptoms"
  | "context"
  | "framework"
  | "interaction"
  | "generated";

export type GuidedCaseDraft = {
  caseType: "training_simulation";
  step: GuidedStepId;
  presentationId: string | null;
  presentationSlug: string | null;
  presentationName: string | null;
  dsm5Code: string | null;
  icd11Code: string | null;
  profile: {
    displayName: string;
    age: number;
    gender: ClinicalCore["gender"];
    occupation: string;
    education: string;
    relationshipStatus: string;
    livingSituation: string;
    culturalContext: string;
    city: string;
    country: string;
  };
  goals: SessionGoalItem[];
  customGoalDraft: string;
  symptoms: SymptomProfileItem[];
  aiSymptomSuggestions: SymptomProfileItem[];
  contextNarrative: string;
  structuredContext: StructuredContext | null;
  structuredContextApproved: boolean;
  primaryFramework: TherapyModality | null;
  supportingFrameworks: TherapyModality[];
  frameworkRationale: string;
  communicationStyle: CommunicationStyle | null;
  therapeuticChallenges: TherapeuticChallenge[];
  disclosureRules: DisclosureRule[];
  riskProfile: RiskProfile;
  severity: ClinicalCore["severity"];
  generated: GeneratedCaseBundle | null;
  sectionApprovals: Partial<Record<SectionApprovalKey, boolean>>;
  avatarId: string | null;
  slug: string;
  voiceProfileId: string | null;
  lastError: string | null;
};

export function emptyGuidedDraft(
  defaults?: Partial<GuidedCaseDraft>,
): GuidedCaseDraft {
  return {
    caseType: "training_simulation",
    step: "presentation",
    presentationId: null,
    presentationSlug: null,
    presentationName: null,
    dsm5Code: null,
    icd11Code: null,
    profile: {
      displayName: "",
      age: 28,
      gender: "unspecified",
      occupation: "",
      education: "",
      relationshipStatus: "",
      livingSituation: "",
      culturalContext: "",
      city: "",
      country: "",
    },
    goals: [],
    customGoalDraft: "",
    symptoms: [],
    aiSymptomSuggestions: [],
    contextNarrative: "",
    structuredContext: null,
    structuredContextApproved: false,
    primaryFramework: null,
    supportingFrameworks: [],
    frameworkRationale: "",
    communicationStyle: null,
    therapeuticChallenges: [],
    disclosureRules: [],
    riskProfile: { suicidal_ideation: "none" },
    severity: "moderate",
    generated: null,
    sectionApprovals: {},
    avatarId: null,
    slug: "",
    voiceProfileId: null,
    lastError: null,
    ...defaults,
  };
}

export function slugifyDisplayName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!base) return `training-patient-${Date.now().toString(36)}`;
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

export function customGoal(label: string): SessionGoalItem {
  return {
    id: `custom-${Date.now().toString(36)}`,
    label: label.trim(),
    category: "custom" as GoalCategoryId,
    custom: true,
  };
}
