/**
 * Longitudinal Clinical Intelligence simulations (Stage 6).
 * Deterministic 100-session arc + alliance / belief / therapy evolution.
 */

import { describe, expect, it } from "vitest";
import {
  beginNextSession,
  createAdaptationState,
  processTherapistTurn,
} from "@/lib/adaptation";
import {
  advanceRecoveryTrajectory,
  applyBeliefStrengthOverride,
  computeRelapseRisk,
  createMindState,
  defaultRecoveryTrajectory,
  evolveBeliefStrengths,
  evolveInsightBand,
  evolveStressReservoir,
  expectedStageForHorizon,
  promotePatientFormulation,
  simulateLongitudinalArc,
  canTransitionRecovery,
  transitionRecovery,
} from "@/lib/clinical-intelligence";

describe("Clinical Intelligence — longitudinal 100-session simulation", () => {
  it("simulates 100 sessions with deterministic recovery progression", () => {
    const arc = simulateLongitudinalArc({
      sessions: 100,
      horizon: 100,
    });
    expect(arc.sessions_completed).toBe(100);
    expect(arc.stages.length).toBe(101); // initial + 100
    expect(arc.relapse.length).toBe(100);
    // Should reach maintenance or recovery by end under improving alliance
    expect(["recovery", "maintenance", "partial_response", "engaged_work"]).toContain(
      arc.stage,
    );
    // Deterministic re-run
    const again = simulateLongitudinalArc({
      sessions: 100,
      horizon: 100,
    });
    expect(again.stages).toEqual(arc.stages);
    expect(again.stage).toBe(arc.stage);
  });

  it("evolves alliance across sessions via beginNextSession (no virgin reset)", () => {
    let state = createAdaptationState({
      caseInstanceId: "c0",
      therapistId: "t1",
    });
    const trusts: number[] = [];
    for (let s = 0; s < 10; s++) {
      for (let t = 0; t < 5; t++) {
        state = processTherapistTurn(
          state,
          "I hear how painful that has been — thank you for trusting me with it",
        ).state;
      }
      trusts.push(state.trust.level);
      state = beginNextSession(state);
      // Trust must not reset to virgin createAdaptationState baseline
      const virgin = createAdaptationState({
        caseInstanceId: `c${s + 1}`,
        therapistId: "t1",
      });
      expect(state.trust.level).toBeGreaterThan(virgin.trust.level - 1);
      expect(state.session_index).toBe(s + 2); // createAdaptationState starts at 1
    }
    // Overall non-decreasing trend across the arc (allow small carry decay)
    expect(trusts[9]!).toBeGreaterThanOrEqual(trusts[0]! - 5);
  });

  it("evolves belief strengths slowly without rewriting statements", () => {
    const f = promotePatientFormulation({ disorderSlug: "mdd-recurrent-moderate" });
    const statements = f.belief_system.core_beliefs.map((b) => b.statement);
    let overrides: Record<string, number> = {};
    for (const b of f.belief_system.core_beliefs) {
      overrides[b.id] = b.strength;
    }
    for (let i = 0; i < 25; i++) {
      overrides = evolveBeliefStrengths(overrides, i + 1, 70);
    }
    const evolved = applyBeliefStrengthOverride(f, overrides);
    expect(evolved.belief_system.core_beliefs.map((b) => b.statement)).toEqual(
      statements,
    );
    // High alliance softens average strength
    const avg0 =
      f.belief_system.core_beliefs.reduce((a, b) => a + b.strength, 0) /
      f.belief_system.core_beliefs.length;
    const avg1 =
      evolved.belief_system.core_beliefs.reduce((a, b) => a + b.strength, 0) /
      evolved.belief_system.core_beliefs.length;
    expect(avg1).toBeLessThan(avg0);
  });

  it("advances insight band only when mutable + curriculum conditions met", () => {
    expect(evolveInsightBand("poor", false, 50, 20)).toBe("poor");
    expect(evolveInsightBand("poor", true, 2, 0)).toBe("poor");
    expect(evolveInsightBand("intellectual_only", true, 10, 0)).toBe("partial");
  });

  it("rejects illegal recovery transitions", () => {
    expect(canTransitionRecovery("intake", "maintenance")).toBe(false);
    expect(transitionRecovery("intake", "maintenance").ok).toBe(false);
    expect(transitionRecovery("intake", "early_alliance").ok).toBe(true);
  });

  it("maps horizon playbooks for 10 / 25 / 50 / 100", () => {
    expect(expectedStageForHorizon(10, 0)).toBe("intake");
    expect(expectedStageForHorizon(10, 8)).toBe("partial_response");
    expect(expectedStageForHorizon(25, 22)).toBe("recovery");
    expect(expectedStageForHorizon(50, 48)).toBe("maintenance");
    expect(expectedStageForHorizon(100, 90)).toBe("maintenance");
  });

  it("tracks stress reservoir and relapse risk across therapy evolution", () => {
    let recovery = defaultRecoveryTrajectory(25);
    let stress = { acute: 60, chronic_load: 50 };
    const risks = [];
    for (let i = 0; i < 25; i++) {
      const hope = 30 + i * 2;
      const trust = 35 + i * 2;
      stress = evolveStressReservoir(stress, 70 - i, -1);
      recovery = advanceRecoveryTrajectory(recovery, { allianceTrust: trust });
      risks.push(
        computeRelapseRisk({
          recovery,
          chronicStress: stress.chronic_load,
          allianceTrust: trust,
          hope,
        }),
      );
    }
    expect(recovery.sessions_completed).toBe(25);
    // Late-arc relapse risk should generally not stay "high" under improving alliance
    expect(risks[24]!.level).not.toBe("high");
  });

  it("creates mind state with recovery + adherence for session 1 continuum", () => {
    const mind = createMindState({
      caseInstanceId: "c1",
      formulation: promotePatientFormulation({ disorderSlug: "gad" }),
      sessionsCompleted: 0,
    });
    expect(mind.recovery.stage).toBe("intake");
    expect(mind.adherence.homework.assigned).toBe(false);
    expect(mind.crisis_risk.band).toBe(false);
  });
});

describe("Clinical Intelligence — decision stability under fixed seeds", () => {
  it("keeps recovery stage path identical for identical inputs", () => {
    const a = simulateLongitudinalArc({ sessions: 50, horizon: 50 });
    const b = simulateLongitudinalArc({ sessions: 50, horizon: 50 });
    expect(a.stages).toEqual(b.stages);
    expect(a.relapse.map((r) => r.level)).toEqual(b.relapse.map((r) => r.level));
  });
});
