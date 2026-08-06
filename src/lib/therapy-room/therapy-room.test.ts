import { describe, expect, it, beforeEach } from "vitest";
import {
  ARRIVAL_BEATS,
  DEPARTURE_BEATS,
  beatStartTimes,
  totalArrivalMs,
  totalDepartureMs,
} from "./arrival";
import { chartSectionsForDifficulty, isChartSectionVisible } from "./chart-visibility";
import { buildAppointmentCard, patientFirstName, patientInitials, urgencyFromRisk } from "./clinic-schedule";
import {
  clearImmersionAdapters,
  listImmersionAdapters,
  publishImmersionEvent,
  registerImmersionAdapter,
} from "./immersion";
import { assertNotesExcludedFromPatientContext, templateForFormat } from "./notes";
import { resolvePatientNonverbal } from "./patient-behavior";
import { buildSupervisorBriefing } from "./supervisor";
import { buildDailyClinicSummary } from "./daily-summary";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

describe("therapy-room chart visibility", () => {
  it("shows diagnosis to beginners but not experts", () => {
    expect(isChartSectionVisible("diagnosis", "beginner")).toBe(true);
    expect(isChartSectionVisible("diagnosis", "expert")).toBe(false);
    expect(chartSectionsForDifficulty("expert")).toEqual([
      "referral_letter",
      "chief_complaint",
      "session_number",
      "risk_alerts",
    ]);
  });
});

describe("therapy-room arrival choreography", () => {
  it("takes a natural multi-second total, never instant", () => {
    expect(totalArrivalMs()).toBeGreaterThan(5000);
    expect(totalDepartureMs()).toBeGreaterThan(4000);
    expect(ARRIVAL_BEATS.map((b) => b.id)).toEqual([
      "knock",
      "open",
      "enter",
      "sit",
      "greet",
    ]);
    expect(DEPARTURE_BEATS[DEPARTURE_BEATS.length - 1]?.id).toBe("door");
    expect(beatStartTimes(ARRIVAL_BEATS)[0]).toBe(0);
  });
});

describe("therapy-room clinic schedule", () => {
  it("uses first name / initials only", () => {
    expect(patientFirstName("Maya Chen")).toBe("Maya");
    expect(patientInitials("Maya Chen")).toBe("MC");
    expect(urgencyFromRisk("active_with_plan")).toBe("emergent");
  });

  it("builds appointment cards with referral and slot time", () => {
    const card = buildAppointmentCard({
      clinicDayId: "day-1",
      avatarId: "av-1",
      avatarName: "Maya Chen",
      portraitUrl: null,
      slotIndex: 0,
      dayStartIso: "2026-08-06T09:00:00.000Z",
      showDiagnosis: true,
      diagnosis: "Major depressive disorder",
      difficulty: "beginner",
    });
    expect(card.patientDisplay).toBe("Maya");
    expect(card.referralSource).toContain("referral");
    expect(card.diagnosis).toBe("Major depressive disorder");
  });
});

describe("therapy-room patient nonverbal", () => {
  it("is deterministic for the same snapshot", () => {
    const snap = {
      primary_diagnosis: { slug: "mdd-recurrent-moderate", name: "MDD" },
      difficulty_modifiers: {
        insight: "partial",
        resistance: "high",
        disclosure: "guarded",
        masking: "moderate",
        alliance: "fragile",
        diagnostic_ambiguity: "low",
        comorbidity_weight: "low",
      },
      clinical_core: {
        risk_profile: { suicidal_ideation: "passive" },
      },
    } as unknown as CaseInstanceSnapshot;

    const a = resolvePatientNonverbal(snap);
    const b = resolvePatientNonverbal(snap);
    expect(a).toEqual(b);
    expect(a.defenceMechanisms.length).toBeGreaterThan(0);
    expect(a.speechTempo).toMatch(/slow|low/i);
  });
});

describe("therapy-room immersion bus", () => {
  beforeEach(() => clearImmersionAdapters());

  it("delivers events to matching adapters", () => {
    const seen: string[] = [];
    registerImmersionAdapter({
      id: "test-vr",
      channels: ["patient.pose", "session.phase"],
      onEvent: (e) => {
        seen.push(e.channel);
      },
    });
    publishImmersionEvent("patient.pose", { posture: "forward" });
    publishImmersionEvent("haptic", { pulse: 1 });
    expect(seen).toEqual(["patient.pose"]);
    expect(listImmersionAdapters()).toHaveLength(1);
  });
});

describe("therapy-room notes isolation", () => {
  it("templates SOAP and asserts notes never leak into patient prompt", () => {
    expect(templateForFormat("soap")).toContain("S:");
    expect(
      assertNotesExcludedFromPatientContext(
        ["You are Maya", "Speak slowly"],
        ["Private: patient seems ashamed about grandmother"],
      ),
    ).toBe(true);
    expect(
      assertNotesExcludedFromPatientContext(
        ["Private: patient seems ashamed about grandmother"],
        ["Private: patient seems ashamed about grandmother"],
      ),
    ).toBe(false);
  });
});

describe("therapy-room supervisor + daily summary", () => {
  it("builds residency-style briefing without requiring report scores", () => {
    const briefing = buildSupervisorBriefing({
      sessionId: "s1",
      patientDisplay: "Maya",
      coach: {
        supervisor_feedback: "Solid risk enquiry.",
        missed_opportunities: ["Missed trauma screen"],
        suggested_reading: ["SAFE-T"],
        learning_goals: ["Raise suicide assessment"],
        reflective_questions: ["What cue did you miss?"],
        improvement_plan: "Practice C-SSRS.",
      },
    });
    expect(briefing.missedOpportunities[0]).toMatch(/trauma/i);
    expect(briefing.relevantLiterature).toContain("SAFE-T");

    const day = buildDailyClinicSummary({
      clinicDayId: "d1",
      date: "2026-08-06",
      appointments: [
        buildAppointmentCard({
          clinicDayId: "d1",
          avatarId: "a",
          avatarName: "Maya Chen",
          portraitUrl: null,
          slotIndex: 0,
          dayStartIso: "2026-08-06T09:00:00.000Z",
          showDiagnosis: false,
          status: "completed",
          urgency: "urgent",
        }),
      ],
      briefings: [briefing],
    });
    expect(day.patientsSeen).toBe(1);
    expect(day.riskEvents.length).toBe(1);
  });
});
