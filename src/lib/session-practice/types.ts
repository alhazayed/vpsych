/**
 * Session Practice Engine — observable best-practice checks on a completed
 * session transcript (intake, consent, session structure, safety planning,
 * standardised measures) plus an indicative CTS-R view.
 *
 * Observes only. Never writes patient state. Not a validated instrument.
 */

export const SESSION_PRACTICE_VERSION = "session-practice.v1" as const;

export type PracticeGroup =
  | "intake"
  | "consent"
  | "structure"
  | "safety_plan"
  | "measures";

export type PracticeCheckId =
  // Intake (first-session interview structure)
  | "role_intro"
  | "presenting_problem"
  | "history"
  | "social_context"
  | "expectations"
  // Informed consent and confidentiality (APA 10.01 / 4.02)
  | "confidentiality"
  | "confidentiality_limits"
  | "consent_to_proceed"
  // Session structure (Beck; CTS-R items 1, 4, 11, 12)
  | "mood_check"
  | "bridge"
  | "agenda"
  | "homework_review"
  | "homework_set"
  | "summary"
  | "feedback_elicited"
  // Safety planning (Stanley-Brown components)
  | "warning_signs"
  | "internal_coping"
  | "social_supports"
  | "professional_contacts"
  | "means_safety"
  // Standardised self-report measures
  | "phq9"
  | "gad7";

export type PracticeCheck = {
  id: PracticeCheckId;
  group: PracticeGroup;
  detected: boolean;
  /** False when the practice is not expected in this session. */
  applicable: boolean;
  /** Index among therapist turns (0-based) of the first evidence, if any. */
  turn_index: number | null;
  excerpt: string | null;
};

export type PracticeGroupSummary = {
  group: PracticeGroup;
  applicable: boolean;
  met: number;
  total: number;
  /** met / total in [0, 1]; null when the group is not applicable. */
  coverage: number | null;
};

export type SessionPracticeInput = {
  messages: Array<{ role: string; content: string }>;
  /** 1-based session number in a course; unknown means a standalone session. */
  sessionNumber?: number | null;
  /** True when the case carries suicidal ideation or self-harm. */
  riskPresent?: boolean;
};

export type SessionPracticeReport = {
  version: typeof SESSION_PRACTICE_VERSION;
  checks: PracticeCheck[];
  groups: PracticeGroupSummary[];
  limitations: string[];
};

export type CtsrItemId =
  | "agenda_setting"
  | "collaboration"
  | "guided_discovery"
  | "feedback"
  | "conceptual_integration"
  | "eliciting_cognitions"
  | "eliciting_emotion"
  | "eliciting_behaviours"
  | "change_methods"
  | "interpersonal_effectiveness"
  | "pacing"
  | "homework";

export type CtsrItem = {
  id: CtsrItemId;
  /** 0 (incompetent) – 6 (expert); null when no evidence source exists. */
  score: number | null;
  source: "checklist" | "rubric" | "none";
};

export type IndicativeCtsr = {
  version: typeof SESSION_PRACTICE_VERSION;
  items: CtsrItem[];
  rated: number;
  /** Sum out of 72 — only when all 12 items have a score. */
  total: number | null;
  limitations: string[];
};

export type MeasureId = "phq9" | "gad7";

export type SelfReportTarget = {
  measure: MeasureId;
  /** Per-item frequency 0–3 (not at all … nearly every day). */
  items: number[];
  total: number;
};

export type SelfReportProfile = {
  phq9: SelfReportTarget;
  gad7: SelfReportTarget;
};
