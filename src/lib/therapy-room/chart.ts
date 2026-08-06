/**
 * Build a difficulty-gated pre-session chart from case snapshot + appointment.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { chartSectionsForDifficulty } from "./chart-visibility";
import type { ClinicAppointmentCard, PreSessionChart } from "./types";

function riskAlertsFromSnapshot(
  snapshot: CaseInstanceSnapshot | null | undefined,
): string[] {
  const alerts: string[] = [];
  const risk = snapshot?.clinical_core?.risk_profile;
  if (!risk) return alerts;
  if (risk.suicidal_ideation && risk.suicidal_ideation !== "none") {
    alerts.push(`Suicidal ideation: ${risk.suicidal_ideation.replace(/_/g, " ")}`);
  }
  if (risk.self_harm) alerts.push("History of self-harm noted in referral");
  if (risk.harm_to_others) alerts.push("Harm-to-others concern on file");
  if (risk.substance_use) alerts.push("Substance use flagged");
  if (risk.escalation_rules) alerts.push(risk.escalation_rules);
  return alerts;
}

export function buildPreSessionChart(opts: {
  appointment: ClinicAppointmentCard;
  snapshot?: CaseInstanceSnapshot | null;
  disorderLabel?: string | null;
}): PreSessionChart {
  const { appointment, snapshot, disorderLabel } = opts;
  const difficulty = appointment.difficulty;
  const sections = chartSectionsForDifficulty(difficulty);
  const show = (id: (typeof sections)[number]) => sections.includes(id);

  const dx =
    snapshot?.primary_diagnosis?.name ??
    disorderLabel ??
    appointment.diagnosis;

  const chief =
    snapshot?.clinical_core?.symptom_profile
      ?.filter((s) => s.salience === "presenting")
      .map((s) => s.description)
      .slice(0, 3)
      .join("; ") ||
    snapshot?.clinical_core?.session_goals?.[0] ||
    "Presenting concern per referral.";

  const meds = appointment.currentMedications;

  return {
    appointmentId: appointment.id,
    patientDisplay: appointment.patientDisplay,
    difficulty,
    visibleSections: sections,
    referralLetter: show("referral_letter")
      ? [
          `Referral source: ${appointment.referralSource}.`,
          `Please assess ${appointment.patientDisplay} for outpatient follow-up.`,
          chief ? `Chief concern summarised as: ${chief}.` : null,
          "Thank you for seeing this patient in clinic today.",
        ]
          .filter(Boolean)
          .join("\n\n")
      : null,
    chiefComplaint: show("chief_complaint") ? chief : null,
    previousSummary: show("previous_summary")
      ? appointment.previousAttendance === "First visit"
        ? "No prior clinic notes on file."
        : `Prior attendance: ${appointment.previousAttendance}. Continue longitudinal care.`
      : null,
    currentMedication: show("current_medication") ? meds : null,
    riskAlerts: show("risk_alerts") ? riskAlertsFromSnapshot(snapshot) : [],
    previousTherapistNotes: show("previous_notes")
      ? appointment.sessionNumber > 1
        ? "Previous therapist: alliance developing; homework partially completed; continue risk review each visit."
        : null
      : null,
    homeworkStatus: show("homework_status")
      ? appointment.sessionNumber > 1
        ? "Homework: partial — patient reports incomplete practice."
        : "No homework assigned yet."
      : null,
    laboratory: show("laboratory") ? null : null,
    psychologicalTesting: show("psychological_testing") ? null : null,
    diagnosis: show("diagnosis") ? dx : null,
    sessionNumber: appointment.sessionNumber,
  };
}
