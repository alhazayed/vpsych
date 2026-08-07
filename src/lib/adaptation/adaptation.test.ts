/**
 * Mission 8 — Patient Adaptation Engine tests.
 * Rapport Model · Trust Model · Adaptation Engine
 */

import { describe, expect, it } from "vitest";
import {
  ADAPTATION_VERSION,
  beginNextSession,
  createAdaptationState,
  createRapportState,
  createTrustState,
  embedAdaptationInMemory,
  extractAdaptationFromMemory,
  formatAdaptationBlock,
  processTherapistTurn,
  signalTherapistBehaviour,
  updateRapport,
  updateTrust,
} from "@/lib/adaptation";

describe("Mission 8 — Patient Adaptation", () => {
  describe("signals", () => {
    it("detects warmth", () => {
      const s = signalTherapistBehaviour(
        "I'm glad you're here today. Take your time.",
      );
      expect(s.warmth).toBeGreaterThanOrEqual(8);
      expect(s.cues).toContain("warmth");
    });

    it("detects judgment", () => {
      const s = signalTherapistBehaviour(
        "You should just stop being so dramatic and admit it.",
      );
      expect(s.judgment).toBeGreaterThanOrEqual(12);
      expect(s.cues).toContain("judgment");
    });

    it("detects interruptions", () => {
      const s = signalTherapistBehaviour(
        "Let me stop you there. Anyway, next question — how is sleep?",
      );
      expect(s.interruption).toBeGreaterThanOrEqual(12);
      expect(s.cues).toContain("interruption");
    });

    it("detects excellent empathy (reflect + validate)", () => {
      const s = signalTherapistBehaviour(
        "It sounds like that must feel really hard. That makes sense — anyone would feel overwhelmed.",
      );
      expect(s.excellent_empathy).toBeGreaterThanOrEqual(10);
      expect(s.cues).toContain("excellent_empathy");
    });

    it("detects Arabic warmth / judgment markers", () => {
      const warm = signalTherapistBehaviour("شكرا إنك هون، خذي وقتك.");
      expect(warm.warmth).toBeGreaterThanOrEqual(8);
      const judge = signalTherapistBehaviour("لازم توقف عن هيك، ليش ما سمعت الكلام؟");
      expect(judge.judgment).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Rapport Model", () => {
    it("warm therapist → rapport grows faster (velocity rises)", () => {
      let rapport = createRapportState();
      const warm = signalTherapistBehaviour(
        "I'm glad you're here. Take your time — I'm with you.",
      );
      const r1 = updateRapport(rapport, warm);
      const r2 = updateRapport(r1, warm);
      const r3 = updateRapport(r2, warm);
      expect(r3.velocity).toBeGreaterThan(r1.velocity);
      expect(r3.level).toBeGreaterThan(rapport.level);
      // Later warm turns under higher velocity should accumulate more
      const deltaEarly = r1.level - rapport.level;
      const deltaLate = r3.level - r2.level;
      expect(deltaLate).toBeGreaterThanOrEqual(deltaEarly - 0.5);
    });

    it("never jumps more than ~8 points in one turn", () => {
      const rapport = createRapportState();
      const warm = signalTherapistBehaviour(
        "I'm glad you're here. Take your time. I appreciate you trusting me.",
      );
      const next = updateRapport(rapport, warm);
      expect(Math.abs(next.level - rapport.level)).toBeLessThanOrEqual(8);
    });
  });

  describe("Trust Model", () => {
    it("excellent empathy raises trust; judgment lowers it", () => {
      const trust = createTrustState();
      const empathic = signalTherapistBehaviour(
        "It sounds like that must feel really hard. That makes sense — anyone would feel that way.",
      );
      const up = updateTrust(trust, empathic);
      expect(up.level).toBeGreaterThan(trust.level);

      const judge = signalTherapistBehaviour(
        "You should just get over it. Why didn't you listen?",
      );
      const down = updateTrust(up, judge);
      expect(down.level).toBeLessThan(up.level);
    });

    it("never hard-resets trust across updates", () => {
      let trust = createTrustState(70);
      const judge = signalTherapistBehaviour(
        "You need to face it. Obviously you're avoiding this.",
      );
      trust = updateTrust(trust, judge);
      expect(trust.level).toBeGreaterThan(50); // gradual erosion only
    });
  });

  describe("Adaptation Engine", () => {
    it("warm path → rising rapport velocity and engagement", () => {
      let state = createAdaptationState();
      for (let i = 0; i < 4; i++) {
        const r = processTherapistTurn(
          state,
          "I'm glad you're here. Take your time — I'm with you.",
        );
        state = r.state;
      }
      expect(state.rapport.velocity).toBeGreaterThan(1);
      expect(state.rapport.level).toBeGreaterThan(38);
      expect(state.effects.engagement).toBeGreaterThan(40);
    });

    it("judgmental therapist → patient withdraws", () => {
      let state = createAdaptationState();
      const before = state.effects.withdrawal;
      for (let i = 0; i < 3; i++) {
        const r = processTherapistTurn(
          state,
          "You should stop overreacting. Why didn't you just handle it?",
        );
        state = r.state;
      }
      expect(state.effects.withdrawal).toBeGreaterThan(before);
      expect(state.effects.withdrawal).toBeGreaterThanOrEqual(45);
      expect(["withdrawn", "guarded", "angry"]).toContain(state.stance);
    });

    it("interruptions → anger rises", () => {
      let state = createAdaptationState();
      const before = state.effects.anger;
      const r = processTherapistTurn(
        state,
        "Let me stop you there. Anyway, moving on — next question?",
      );
      state = r.state;
      expect(state.effects.anger).toBeGreaterThan(before);
      expect(r.signals.cues).toContain("interruption");
    });

    it("excellent empathy → earlier disclosure readiness", () => {
      let state = createAdaptationState();
      const before = state.effects.disclosure_readiness;
      for (let i = 0; i < 3; i++) {
        const r = processTherapistTurn(
          state,
          "It sounds like that must feel really hard. That makes sense — anyone would feel overwhelmed. You're not alone in this.",
        );
        state = r.state;
      }
      expect(state.effects.disclosure_readiness).toBeGreaterThan(before);
      expect(state.trust.level).toBeGreaterThan(40);
    });

    it("patient evolves across treatment sessions (no hard reset)", () => {
      let state = createAdaptationState();
      for (let i = 0; i < 5; i++) {
        state = processTherapistTurn(
          state,
          "I'm glad you're here. It sounds hard — that makes sense. Anyone would feel that way.",
        ).state;
      }
      const midRapport = state.rapport.level;
      const midTrust = state.trust.level;
      expect(midRapport).toBeGreaterThan(38);
      expect(midTrust).toBeGreaterThan(40);

      state = beginNextSession(state);
      expect(state.session_index).toBe(2);
      expect(state.rapport.sessions_together).toBe(2);
      expect(state.treatment_arc.sessions_completed).toBe(1);
      // Continuity: not back at cold stranger baseline
      expect(state.rapport.level).toBeGreaterThan(30);
      expect(state.trust.level).toBeGreaterThan(30);
      expect(Math.abs(state.rapport.level - midRapport)).toBeLessThan(25);
    });

    it("expression block is enactable Module ADAPTATION text", () => {
      const state = createAdaptationState();
      const r = processTherapistTurn(
        state,
        "I'm glad you're here. Take your time.",
      );
      expect(r.expressionBlock).toContain("MODULE ADAPTATION");
      expect(r.expressionBlock).toContain("Stance:");
      expect(formatAdaptationBlock(r.directive)).toContain("Mission 8");
    });

    it("persists into case_memory blob shape", () => {
      const state = createAdaptationState({ caseInstanceId: "c1" });
      const advanced = processTherapistTurn(
        state,
        "I'm glad you're here.",
      ).state;
      const blob = embedAdaptationInMemory({ turns: [], notes: [] }, advanced);
      expect(blob.adaptation_version).toBe(ADAPTATION_VERSION);
      expect(blob.patient_adaptation?.rapport.level).toBe(
        advanced.rapport.level,
      );
      const roundTrip = extractAdaptationFromMemory(blob);
      expect(roundTrip?.trust.level).toBe(advanced.trust.level);
      expect(extractAdaptationFromMemory({})).toBeNull();
    });
  });
});
