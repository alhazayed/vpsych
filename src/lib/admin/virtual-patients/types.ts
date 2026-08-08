/**
 * Admin Virtual Patient UX contracts.
 * Maps clinical admin language → existing avatars row / clinical_core /
 * personalities / human_personality. Never exposes raw DB jargon in UI copy.
 */

export type VirtualPatientLifecycle =
  | "draft"
  | "testing"
  | "published"
  | "archived";

export type BehaviorTrigger =
  | "asked_about_symptoms"
  | "asked_about_trauma"
  | "advice_too_early"
  | "therapist_empathy"
  | "asked_about_suicide"
  | "closed_questions";

export type BehaviorResponse =
  | "usually_direct"
  | "initially_avoids_then_discloses"
  | "becomes_defensive"
  | "becomes_more_open"
  | "hesitant_then_responds"
  | "shorter_answers";

export type InteractionStyle =
  | "cooperative"
  | "guarded"
  | "avoidant"
  | "irritable"
  | "emotional"
  | "withdrawn"
  | "circumstantial";

export type TrainingCompetency =
  | "diagnostic_interview"
  | "mental_status_examination"
  | "dsm5_reasoning"
  | "icd11_reasoning"
  | "differential_diagnosis"
  | "risk_assessment"
  | "suicide_assessment"
  | "violence_assessment"
  | "empathy"
  | "validation"
  | "open_questions"
  | "summarization"
  | "termination";

export type BehaviorRule = {
  trigger: BehaviorTrigger;
  response: BehaviorResponse;
};

/** Wizard / edit form payload (human-readable admin fields). */
export type VirtualPatientDraft = {
  displayName: string;
  age: number;
  gender: "female" | "male" | "non-binary" | "unspecified";
  language: "en" | "ar";
  dialect: string;
  occupation: string;
  primaryDiagnosis: string;
  comorbidities: string[];
  severity: "subclinical" | "mild" | "moderate" | "severe";
  presentingComplaint: string;
  clinicalHistory: string;
  previousTreatment: string;
  medication: string;
  familyHistory: string;
  socialHistory: string;
  traumaHistory: string;
  medicalHistory: string;
  traits: {
    trust: 1 | 2 | 3 | 4 | 5;
    anxiety: 1 | 2 | 3 | 4 | 5;
    defensiveness: 1 | 2 | 3 | 4 | 5;
    emotionalExpressiveness: 1 | 2 | 3 | 4 | 5;
    insight: 1 | 2 | 3 | 4 | 5;
    cooperation: 1 | 2 | 3 | 4 | 5;
  };
  interactionStyles: InteractionStyle[];
  behaviorRules: BehaviorRule[];
  portraitUrl: string | null;
  voiceProfileId: string | null;
  speakingSpeed: "slow" | "normal" | "fast";
  emotionalBaseline: "calm" | "anxious" | "low" | "irritable" | "flat";
  targetCompetencies: TrainingCompetency[];
  difficulty: "introductory" | "standard" | "advanced" | "expert";
  therapyModality: string;
  expectedSessionMinutes: number;
  lifecycleStatus?: VirtualPatientLifecycle;
};

export type VirtualPatientListItem = {
  id: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  diagnosis: string;
  difficulty: string | null;
  language: string | null;
  dialect: string | null;
  status: VirtualPatientLifecycle;
  targetCompetencies: string[];
  portraitUrl: string | null;
  updatedAt: string;
};

export type DuplicateVirtualPatientInput = {
  newName: string;
  newDiagnosis?: string;
  newDifficulty?: VirtualPatientDraft["difficulty"];
  language?: "en" | "ar";
  dialect?: string;
};

export const BEHAVIOR_TRIGGER_LABELS: Record<BehaviorTrigger, string> = {
  asked_about_symptoms: "When asked about symptoms",
  asked_about_trauma: "When asked about trauma",
  advice_too_early: "When the therapist gives advice too early",
  therapist_empathy: "When the therapist demonstrates empathy",
  asked_about_suicide: "When asked about suicide",
  closed_questions: "When the therapist repeatedly asks closed questions",
};

export const BEHAVIOR_RESPONSE_LABELS: Record<BehaviorResponse, string> = {
  usually_direct: "Usually answers directly",
  initially_avoids_then_discloses: "Initially avoids, then gradually discloses",
  becomes_defensive: "Becomes defensive",
  becomes_more_open: "Becomes more open",
  hesitant_then_responds:
    "Initially hesitant, then responds to appropriate exploration",
  shorter_answers: "Gives shorter answers",
};

export const COMPETENCY_LABELS: Record<TrainingCompetency, string> = {
  diagnostic_interview: "Diagnostic interview",
  mental_status_examination: "Mental status examination",
  dsm5_reasoning: "DSM-5 reasoning",
  icd11_reasoning: "ICD-11 reasoning",
  differential_diagnosis: "Differential diagnosis",
  risk_assessment: "Risk assessment",
  suicide_assessment: "Suicide assessment",
  violence_assessment: "Violence assessment",
  empathy: "Empathy",
  validation: "Validation",
  open_questions: "Open questions",
  summarization: "Summarization",
  termination: "Termination",
};

export const DEFAULT_VIRTUAL_PATIENT_DRAFT: VirtualPatientDraft = {
  displayName: "",
  age: 30,
  gender: "unspecified",
  language: "en",
  dialect: "American English",
  occupation: "",
  primaryDiagnosis: "",
  comorbidities: [],
  severity: "moderate",
  presentingComplaint: "",
  clinicalHistory: "",
  previousTreatment: "",
  medication: "",
  familyHistory: "",
  socialHistory: "",
  traumaHistory: "",
  medicalHistory: "",
  traits: {
    trust: 3,
    anxiety: 3,
    defensiveness: 3,
    emotionalExpressiveness: 3,
    insight: 3,
    cooperation: 3,
  },
  interactionStyles: ["cooperative"],
  behaviorRules: [
    { trigger: "asked_about_symptoms", response: "usually_direct" },
    {
      trigger: "asked_about_trauma",
      response: "initially_avoids_then_discloses",
    },
    { trigger: "advice_too_early", response: "becomes_defensive" },
    { trigger: "therapist_empathy", response: "becomes_more_open" },
    { trigger: "asked_about_suicide", response: "hesitant_then_responds" },
    { trigger: "closed_questions", response: "shorter_answers" },
  ],
  portraitUrl: "/avatars/maya.svg",
  voiceProfileId: null,
  speakingSpeed: "normal",
  emotionalBaseline: "calm",
  targetCompetencies: ["diagnostic_interview", "empathy", "open_questions"],
  difficulty: "standard",
  therapyModality: "supportive",
  expectedSessionMinutes: 40,
  lifecycleStatus: "draft",
};
