/**
 * End-of-day clinic summary — residency wrap-up, not an AI analytics dashboard.
 */

import type {
  AppointmentStatus,
  ClinicAppointmentCard,
  DailyClinicSummary,
  SupervisorBriefing,
} from "./types";

export function buildDailyClinicSummary(opts: {
  clinicDayId: string;
  date: string;
  appointments: ClinicAppointmentCard[];
  briefings?: SupervisorBriefing[];
  reflectionJournal?: string;
}): DailyClinicSummary {
  const seen = opts.appointments.filter(
    (a) => a.status === "completed" || a.status === "in_session",
  );
  const riskEvents = opts.appointments
    .filter((a) => a.urgency === "urgent" || a.urgency === "emergent")
    .map(
      (a) =>
        `${a.patientDisplay} — ${a.urgency} (${a.referralSource})`,
    );

  const objectives = new Set<string>();
  const study = new Set<string>();
  const supervisorComments: string[] = [];

  for (const b of opts.briefings ?? []) {
    for (const g of b.competencyProgression) objectives.add(g);
    for (const r of b.relevantLiterature) study.add(r);
    if (b.whatHappened) supervisorComments.push(b.whatHappened.slice(0, 280));
  }

  return {
    clinicDayId: opts.clinicDayId,
    date: opts.date,
    patientsSeen: seen.length,
    averageAlliance: null,
    averageCompetency: null,
    riskEvents,
    learningObjectivesAchieved: [...objectives].slice(0, 8),
    reflectionJournal:
      opts.reflectionJournal?.trim() ||
      "What did I notice about my pacing, alliance, and risk enquiry today?",
    recommendedStudyTopics: [...study].slice(0, 8),
    supervisorComments: supervisorComments.slice(0, 5),
    appointmentSummaries: opts.appointments.map((a) => ({
      patientDisplay: a.patientDisplay,
      status: a.status as AppointmentStatus,
      diagnosis: a.diagnosis,
    })),
  };
}
