/**
 * Lightweight performance smoke for Clinical Intelligence helpers.
 * Guards against accidental O(n²) / heavy allocation on the hot path.
 */

import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import {
  decidePatientTurn,
  promoteClinicalIntelligence,
  promotePatientFormulation,
  simulateLongitudinalArc,
  therapyEffectForIntervention,
  defaultTherapyResponseProfile,
} from "@/lib/clinical-intelligence";

describe("Clinical Intelligence — performance smoke", () => {
  it("decision + therapy effect stay under 5ms each for fixed inputs", () => {
    const formulation = promotePatientFormulation({
      disorderSlug: "mdd-recurrent-moderate",
    });
    const profile = defaultTherapyResponseProfile("cbt");
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      decidePatientTurn({
        formulation,
        therapyProfile: profile,
        modality: "cbt",
        therapistMessage: "What thoughts went through your mind then?",
        disorderSlug: "mdd-recurrent-moderate",
      });
      therapyEffectForIntervention("validation", profile);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200); // 200 iters → <1ms avg
  });

  it("100-session simulation completes quickly", () => {
    const t0 = performance.now();
    const arc = simulateLongitudinalArc({ sessions: 100, horizon: 100 });
    const elapsed = performance.now() - t0;
    expect(arc.sessions_completed).toBe(100);
    expect(elapsed).toBeLessThan(50);
  });

  it("promotion does not allocate unbounded objects", () => {
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      promoteClinicalIntelligence({
        clinicalCore: {
          disorder: "MDD",
          age: 28,
          gender: "female",
          symptom_profile: [],
          disclosure_rules: [],
          session_goals: ["a"],
          ideal_approach: "CBT",
          risk_profile: { suicidal_ideation: "none" },
        },
        disorderSlug: "mdd-recurrent-moderate",
        difficultyInsight: "partial",
        modality: "cbt",
      });
    }
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
