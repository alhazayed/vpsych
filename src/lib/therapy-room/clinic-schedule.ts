/**
 * Clinic schedule helpers — appointment cards from avatars + session history.
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";
import type {
  AppointmentStatus,
  ClinicAppointmentCard,
  ClinicUrgency,
} from "./types";

export function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

/** First name only — privacy-preserving clinic board display. */
export function patientFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function urgencyFromRisk(
  suicidalIdeation?: string | null,
  riskLevel?: string | null,
): ClinicUrgency {
  if (
    suicidalIdeation === "active_with_plan" ||
    riskLevel === "critical" ||
    riskLevel === "emergent"
  ) {
    return "emergent";
  }
  if (
    suicidalIdeation === "active_no_plan" ||
    riskLevel === "high" ||
    riskLevel === "urgent"
  ) {
    return "urgent";
  }
  if (suicidalIdeation === "passive" || riskLevel === "moderate") {
    return "soon";
  }
  return "routine";
}

export function referralSourceForSlot(slotIndex: number): string {
  const sources = [
    "Primary care referral",
    "Self-referral",
    "Emergency department",
    "Student health",
    "Occupational health",
    "Family physician",
    "Inpatient step-down",
    "Community mental health",
  ];
  return sources[slotIndex % sources.length]!;
}

type BuildSlotInput = {
  clinicDayId: string;
  avatarId: string;
  avatarName: string;
  portraitUrl: string | null;
  slotIndex: number;
  dayStartIso: string;
  sessionId?: string | null;
  status?: AppointmentStatus;
  diagnosis?: string | null;
  difficulty?: CaseDifficulty;
  sessionNumber?: number;
  previousAttendance?: string;
  currentMedications?: string | null;
  outstandingTasks?: string[];
  showDiagnosis: boolean;
  urgency?: ClinicUrgency;
};

export function buildAppointmentCard(input: BuildSlotInput): ClinicAppointmentCard {
  const start = new Date(input.dayStartIso);
  // Clinic slots every 50 minutes from 09:00 local interpretation of dayStart.
  const scheduled = new Date(start.getTime() + input.slotIndex * 50 * 60 * 1000);
  const first = patientFirstName(input.avatarName);

  return {
    id: `${input.clinicDayId}:${input.avatarId}:${input.slotIndex}`,
    clinicDayId: input.clinicDayId,
    avatarId: input.avatarId,
    sessionId: input.sessionId ?? null,
    slotIndex: input.slotIndex,
    scheduledAt: scheduled.toISOString(),
    patientDisplay: first,
    patientInitials: patientInitials(input.avatarName),
    sessionNumber: input.sessionNumber ?? 1,
    referralSource: referralSourceForSlot(input.slotIndex),
    diagnosis: input.showDiagnosis ? (input.diagnosis ?? null) : null,
    urgency: input.urgency ?? "routine",
    previousAttendance: input.previousAttendance ?? "First visit",
    currentMedications: input.currentMedications ?? null,
    outstandingTasks: input.outstandingTasks ?? ["Review referral", "Confirm identity"],
    status: input.status ?? "scheduled",
    difficulty: input.difficulty ?? "intermediate",
    portraitUrl: input.portraitUrl,
  };
}

export function clinicDayDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
