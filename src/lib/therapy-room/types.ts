/**
 * Canonical Therapy Room domain types.
 *
 * One flag (NEXT_PUBLIC_THERAPY_ROOM_MODE), one interaction_mode, one immersion
 * event model (TRII ImmersionEvent), one notes model (session_private_notes).
 * Classic VoiceSession remains default when the flag is off.
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";

/* ─── Therapy Room Mode (TRM) ─────────────────────────────────────────── */

export type InteractionMode = "classic" | "therapy_room";

export type TherapyRoomThemeId =
  | "modern_clinic"
  | "academic_hospital"
  | "community_mental_health"
  | "private_practice"
  | "child_psychiatry"
  | "emergency_psychiatry";

export type PatientAffect =
  | "neutral"
  | "anxious"
  | "depressed"
  | "irritable"
  | "euphoric"
  | "guarded"
  | "tearful"
  | "agitated"
  | "flat"
  | "labile";

/** Discrete nonverbal cues — every cue must originate from PME bridge, never RNG. */
export type NonverbalCue =
  | "idle_breathing"
  | "blink"
  | "look_away"
  | "eye_contact"
  | "fidget"
  | "posture_shift"
  | "sigh"
  | "tears"
  | "laughter"
  | "silence"
  | "cross_arms"
  | "head_down"
  | "restlessness"
  | "hand_tremor"
  | "slow_movements"
  | "psychomotor_agitation"
  | "psychomotor_retardation";

export type PatientPresencePhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "silent";

export type RoomAmbienceKind =
  | "hvac"
  | "chair"
  | "paper"
  | "clock"
  | "silence";

export type TherapyRoomTheme = {
  id: TherapyRoomThemeId;
  labelKey: string;
  /** CSS custom-property overrides for the 2D room (3D maps onto same ids). */
  cssVars: Record<string, string>;
  defaultAmbience: RoomAmbienceKind;
};

/** PME-compatible patient behavior packet for the room renderer. */
export type PatientBehaviorState = {
  disorderSlug: string;
  affect: PatientAffect;
  phase: PatientPresencePhase;
  activeCues: NonverbalCue[];
  /** Thinking latency before first spoken token (ms). */
  thinkingLatencyMs: number;
  /** TTS / playback modulation. */
  voice: VoiceModulation;
  /** Whether this presentation may interrupt the therapist. */
  mayInterruptTherapist: boolean;
  interruptProbability: number;
  /** Future animation hooks — stable string ids for 3D/rig systems. */
  animationHooks: string[];
};

export type VoiceModulation = {
  rate: number;
  volume: number;
  pitch: number;
  pauseScale: number;
  emotion: PatientAffect;
};

export type ImmersionEventKind =
  | "hands_free_turn"
  | "manual_mic_turn"
  | "text_turn"
  | "transcript_opened"
  | "transcript_closed"
  | "pause"
  | "resume"
  | "therapist_interrupt"
  | "patient_interrupt"
  | "control_open"
  | "notes_open"
  | "settings_open"
  | "session_start"
  | "session_end";

/** TRM immersion telemetry event (TRII). */
export type ImmersionEvent = {
  kind: ImmersionEventKind;
  at: number;
};

/**
 * Therapy Room Immersion Index (TRII) — 0–100.
 * Higher = more immersive (less UI distraction, more hands-free continuity).
 */
export type TherapyRoomImmersionIndex = {
  overall: number;
  interfaceDistraction: number;
  conversationContinuity: number;
  handsFreeUsage: number;
  interruptionFrequency: number;
  transcriptDependency: number;
  userImmersion: number;
  eventCounts: Record<string, number>;
};

export type TherapyRoomSettings = {
  themeId: TherapyRoomThemeId;
  showLiveTranscript: boolean;
  showTimer: boolean;
  timerMode: "elapsed" | "remaining";
  muteAvatar: boolean;
  ambienceEnabled: boolean;
  ambienceVolume: number;
};

/* ─── Virtual Mental Health Center (VMHC) ─────────────────────────────── */

export type NoteFormat = "soap" | "dap" | "birp" | "free" | "voice";

export type ClinicUrgency = "routine" | "soon" | "urgent" | "emergent";

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_session"
  | "completed"
  | "no_show"
  | "cancelled";

export type RoomPhase =
  | "lobby"
  | "chart_review"
  | "awaiting_invite"
  | "arrival"
  | "in_session"
  | "paused"
  | "departure"
  | "debrief"
  | "supervisor";

/** Floating toolbar — only these controls exist in the VMHC consultation room. */
export type TherapyRoomToolbarAction =
  | "pause"
  | "resume"
  | "private_notes"
  | "risk_flag"
  | "emergency"
  | "repeat_response"
  | "mute"
  | "settings"
  | "end_session";

export type ChartSectionId =
  | "referral_letter"
  | "chief_complaint"
  | "previous_summary"
  | "current_medication"
  | "risk_alerts"
  | "previous_notes"
  | "homework_status"
  | "laboratory"
  | "psychological_testing"
  | "diagnosis"
  | "session_number";

export type PatientNonverbalProfile = {
  disorderSlug: string;
  posture: string;
  eyeContact: string;
  speechTempo: string;
  movement: string;
  fidgeting: string;
  breathing: string;
  emotionalRegulation: string;
  defenceMechanisms: string[];
  allianceDevelopment: string;
  disclosureTiming: string;
  cssModifiers: {
    scale: number;
    brightness: number;
    saturate: number;
    translateY: number;
    swayMs: number;
    breatheMs: number;
  };
};

export type ClinicAppointmentCard = {
  id: string;
  clinicDayId: string;
  avatarId: string;
  sessionId: string | null;
  slotIndex: number;
  scheduledAt: string;
  patientDisplay: string;
  patientInitials: string;
  sessionNumber: number;
  referralSource: string;
  diagnosis: string | null;
  urgency: ClinicUrgency;
  previousAttendance: string;
  currentMedications: string | null;
  outstandingTasks: string[];
  status: AppointmentStatus;
  difficulty: CaseDifficulty;
  portraitUrl: string | null;
};

export type PreSessionChart = {
  appointmentId: string;
  patientDisplay: string;
  difficulty: CaseDifficulty;
  visibleSections: ChartSectionId[];
  referralLetter: string | null;
  chiefComplaint: string | null;
  previousSummary: string | null;
  currentMedication: string | null;
  riskAlerts: string[];
  previousTherapistNotes: string | null;
  homeworkStatus: string | null;
  laboratory: string | null;
  psychologicalTesting: string | null;
  diagnosis: string | null;
  sessionNumber: number;
};

export type PrivateNoteEntry = {
  id: string;
  sessionId: string;
  format: NoteFormat;
  body: string;
  voiceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArrivalBeat = {
  id: string;
  label: string;
  delayMs: number;
};

export type DepartureBeat = {
  id: string;
  label: string;
  delayMs: number;
};

export type SupervisorBriefing = {
  sessionId: string;
  whatHappened: string;
  whyPatientBehaved: string;
  missedOpportunities: string[];
  strengths: string[];
  alternativeInterventions: string[];
  clinicalPearls: string[];
  evidenceBasedRecommendations: string[];
  relevantLiterature: string[];
  competencyProgression: string[];
  reflectiveQuestions: string[];
  improvementPlan: string;
};

export type DailyClinicSummary = {
  clinicDayId: string;
  date: string;
  patientsSeen: number;
  averageAlliance: number | null;
  averageCompetency: number | null;
  riskEvents: string[];
  learningObjectivesAchieved: string[];
  reflectionJournal: string;
  recommendedStudyTopics: string[];
  supervisorComments: string[];
  appointmentSummaries: Array<{
    patientDisplay: string;
    status: AppointmentStatus;
    diagnosis: string | null;
  }>;
};
