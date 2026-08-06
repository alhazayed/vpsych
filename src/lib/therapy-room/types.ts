/**
 * Virtual Mental Health Center (VMHC) / Therapy Room contracts.
 *
 * Immersion-first clinical day experience. Feature-flagged behind
 * FEATURE_THERAPY_ROOM — does not replace the legacy chat session UI.
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";

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

/** Floating toolbar — only these controls exist in the consultation room. */
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

/**
 * Future-ready immersion bus. UI and engines publish events here;
 * VR / AR / eye-tracking / haptics adapters subscribe without redesign.
 */
export type ImmersionChannel =
  | "room.state"
  | "patient.pose"
  | "patient.gaze"
  | "patient.expression"
  | "patient.body"
  | "audio.therapist"
  | "audio.patient"
  | "haptic"
  | "eye_tracking"
  | "session.phase";

export type ImmersionEvent = {
  channel: ImmersionChannel;
  at: number;
  payload: Record<string, unknown>;
};

export type ImmersionAdapter = {
  id: string;
  channels: ImmersionChannel[];
  onEvent: (event: ImmersionEvent) => void | Promise<void>;
  dispose?: () => void;
};
