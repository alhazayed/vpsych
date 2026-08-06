import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
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
import {
  computeImmersionIndex,
  createImmersionTracker,
  derivePatientBehavior,
  deterministicJitter,
  isTherapyRoomModeEnabled,
  parseInteractionMode,
  resolveTherapyRoomTheme,
  shouldPatientInterruptTherapist,
  shouldUseTherapyRoom,
  thinkingLatencyMs,
  voiceModulationForDisorder,
} from "@/lib/therapy-room";

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

describe("therapy-room feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_THERAPY_ROOM_MODE", "");
    expect(isTherapyRoomModeEnabled()).toBe(false);
    expect(shouldUseTherapyRoom("therapy_room")).toBe(false);
  });

  it("requires flag and explicit therapy_room request", () => {
    vi.stubEnv("NEXT_PUBLIC_THERAPY_ROOM_MODE", "true");
    expect(isTherapyRoomModeEnabled()).toBe(true);
    expect(shouldUseTherapyRoom("classic")).toBe(false);
    expect(shouldUseTherapyRoom("therapy_room")).toBe(true);
    expect(parseInteractionMode("therapy_room")).toBe("therapy_room");
    expect(parseInteractionMode("nope")).toBe("classic");
  });
});

describe("PME bridge", () => {
  it("never uses random — same seed yields same latency", () => {
    const a = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "sess-1:3",
    });
    const b = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "sess-1:3",
    });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(1500);
  });

  it("depression thinks slower than mania", () => {
    const dep = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "x",
    });
    const mania = thinkingLatencyMs({
      disorderSlug: "bipolar-mania",
      seed: "x",
    });
    expect(dep).toBeGreaterThan(mania);
  });

  it("emits phase-specific cues from diagnosis", () => {
    const thinking = derivePatientBehavior({
      disorderSlug: "ptsd",
      phase: "thinking",
      seed: "s",
    });
    expect(thinking.activeCues).toContain("look_away");
    expect(thinking.animationHooks.length).toBeGreaterThan(0);
    expect(thinking.mayInterruptTherapist).toBe(true);
  });

  it("deterministic jitter is stable", () => {
    expect(deterministicJitter("abc", 100)).toBe(
      deterministicJitter("abc", 100),
    );
  });
});

describe("patient interruption", () => {
  it("blocks non-interruptive disorders", () => {
    expect(
      shouldPatientInterruptTherapist({
        disorderSlug: "mdd-recurrent-moderate",
        therapistSpeechMs: 8000,
        seed: "any",
      }),
    ).toBe(false);
  });

  it("allows mania after enough therapist speech when seed agrees", () => {
    // Scan seeds until we find one that hits and one that misses — proves gating works.
    let hit = false;
    let miss = false;
    for (let i = 0; i < 200; i++) {
      const r = shouldPatientInterruptTherapist({
        disorderSlug: "bipolar-mania",
        therapistSpeechMs: 5000,
        seed: `seed-${i}`,
      });
      if (r) hit = true;
      else miss = true;
      if (hit && miss) break;
    }
    expect(hit).toBe(true);
    expect(miss).toBe(true);
  });
});

describe("voice modulation", () => {
  it("slows depressed speech and speeds mania", () => {
    const dep = voiceModulationForDisorder("mdd-recurrent-moderate");
    const mania = voiceModulationForDisorder("bipolar-mania");
    expect(dep.rate).toBeLessThan(1);
    expect(mania.rate).toBeGreaterThan(1);
  });
});

describe("themes", () => {
  it("resolves known and unknown theme ids", () => {
    expect(resolveTherapyRoomTheme("private_practice").id).toBe(
      "private_practice",
    );
    expect(resolveTherapyRoomTheme(null).id).toBe("modern_clinic");
  });
});

describe("TRII immersion index", () => {
  it("scores hands-free continuous sessions highly", () => {
    const tracker = createImmersionTracker();
    tracker.track("session_start");
    for (let i = 0; i < 8; i++) tracker.track("hands_free_turn");
    tracker.track("session_end");
    const index = tracker.finalize();
    expect(index.handsFreeUsage).toBe(100);
    expect(index.overall).toBeGreaterThanOrEqual(70);
  });

  it("penalizes transcript and text dependency", () => {
    const low = computeImmersionIndex([
      { kind: "session_start", at: 0 },
      { kind: "text_turn", at: 1 },
      { kind: "text_turn", at: 2 },
      { kind: "transcript_opened", at: 3 },
      { kind: "transcript_opened", at: 4 },
      { kind: "pause", at: 5 },
      { kind: "settings_open", at: 6 },
      { kind: "session_end", at: 7 },
    ]);
    const high = computeImmersionIndex([
      { kind: "session_start", at: 0 },
      { kind: "hands_free_turn", at: 1 },
      { kind: "hands_free_turn", at: 2 },
      { kind: "hands_free_turn", at: 3 },
      { kind: "session_end", at: 4 },
    ]);
    expect(high.overall).toBeGreaterThan(low.overall);
  });
});
