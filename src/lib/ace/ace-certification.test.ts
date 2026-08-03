import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contentSignatureFromFingerprint,
  detectRepetitionLoop,
  generateAdaptiveCase,
  remediationStepIndex,
} from "@/lib/ace/adaptive";
import { generateCurriculum } from "@/lib/ace/curriculum";
import { createLearnerProfile } from "@/lib/ace/engine";
import {
  simulateLearnerTiers,
  simulateVirtualLearners,
  verifySuccessCriteria,
} from "@/lib/ace/simulate";
import { generateGraphAwareAdaptiveCase } from "@/lib/cge/ace-bridge";
import { SUICIDE_CURRICULUM_STEPS } from "@/lib/ace/catalog";

describe("Adaptive Curriculum certification guards", () => {
  it("meets built-in success criteria", () => {
    const errors = verifySuccessCriteria();
    expect(errors, errors.join("; ")).toEqual([]);
  });

  it("does not trap suicide remediation at Passive SI (C1)", () => {
    let profile = createLearnerProfile({ id: "trap", user_id: "u-trap" });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "suicide_assessment"
          ? { ...c, score: 45, samples: 1 }
          : c,
      ),
    };

    const fingerprints: string[] = [];
    const siStyles: string[] = [];
    const difficulties = new Set<string>();
    for (let i = 0; i < 8; i++) {
      profile = {
        ...profile,
        competencies: profile.competencies.map((row) =>
          row.competency_id === "suicide_assessment"
            ? { ...row, samples: 1 + i, score: 45 }
            : row,
        ),
        completed_case_count: i,
      };
      const path = generateCurriculum(profile);
      expect(path.focus_competency_id).toBe("suicide_assessment");
      const c = generateAdaptiveCase(profile, {
        seed: `trap-${i}`,
        priorFingerprints: fingerprints,
        // First call mimics cold start at step 0; later use exposure step
        stepIndex: i === 0 ? 0 : path.current_step,
      });
      fingerprints.push(c.fingerprint);
      if (c.siStyle) siStyles.push(c.siStyle);
      difficulties.add(c.difficulty);
    }
    expect(siStyles[0]).toBe("passive");
    expect(new Set(siStyles).size).toBeGreaterThan(1);
    expect(difficulties.size).toBeGreaterThan(1);
    expect(
      remediationStepIndex(8, SUICIDE_CURRICULUM_STEPS.length),
    ).toBe(SUICIDE_CURRICULUM_STEPS.length - 1);
  });

  it("does not fabricate CGE root-cause weakness overriding ACE suicide focus (C2)", () => {
    let profile = createLearnerProfile({ id: "c2", user_id: "u-c2" });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) => {
        if (c.competency_id === "suicide_assessment") {
          return { ...c, score: 42, samples: 4 };
        }
        if (c.competency_id === "risk_assessment") {
          return { ...c, score: 40, samples: 4 };
        }
        if (c.competency_id === "diagnostic_interview") {
          return { ...c, score: 78, samples: 5 };
        }
        return c;
      }),
    };
    const graph = generateGraphAwareAdaptiveCase(profile, {
      seed: "c2",
      observedFailure: "risk_assessment",
    });
    expect(graph.focusCompetencies[0]).toBe("suicide_assessment");
    expect(graph.adaptations.some((a) => a.startsWith("cge_root:"))).toBe(true);
    // Original interview score must remain unfabricated in profile
    expect(
      profile.competencies.find((c) => c.competency_id === "diagnostic_interview")!
        .score,
    ).toBe(78);
  });

  it("detects content loops even when fingerprints are salted (H1)", () => {
    const fps = Array.from({ length: 10 }, (_, i) => {
      const base =
        "L|mdd-recurrent-moderate|beginner|suicide_assessment|si_style:passive|passive|0";
      return i === 0 ? base : `${base}#${i}`;
    });
    expect(detectRepetitionLoop(fps, 8)).toBe(true);
    expect(
      new Set(fps.map((f) => contentSignatureFromFingerprint(f))).size,
    ).toBe(1);
  });

  it("honors locked_objectives in case focus (H2)", () => {
    let profile = createLearnerProfile({ id: "lock", user_id: "u-lock" });
    profile = {
      ...profile,
      locked_objectives: ["cbt_skills"],
      competencies: profile.competencies.map((c) =>
        c.competency_id === "suicide_assessment"
          ? { ...c, score: 40, samples: 3 }
          : c.competency_id === "cbt_skills"
            ? { ...c, score: 60, samples: 2 }
            : c,
      ),
    };
    const c = generateAdaptiveCase(profile, { seed: "lock-0" });
    expect(c.focusCompetencies).toContain("cbt_skills");
  });

  it("runs poor/average/excellent learners for ≥100 assessments with distinct curricula", () => {
    const result = simulateLearnerTiers(100);
    expect(result.failures, result.failures.join("; ")).toEqual([]);
    expect(result.curriculaDiffer).toBe(true);
    expect(result.tiers).toHaveLength(3);
    for (const t of result.tiers) {
      expect(t.assessments).toBe(100);
      expect(t.trapped).toBe(false);
      expect(t.contentLoop).toBe(false);
      expect(t.uniqueContent).toBeGreaterThanOrEqual(3);
      expect(t.explainable).toBe(true);
      expect(t.meanConfidence).toBeGreaterThan(30);
    }
  }, 120_000);

  it("keeps large-N adaptive invariants green", () => {
    const result = simulateVirtualLearners(2_000, 6);
    expect(result.failures, result.failures.join("; ")).toEqual([]);
  }, 120_000);

  it("persists adaptive-case history and prefers service-role CGE writes", () => {
    const root = join(process.cwd(), "src");
    const route = readFileSync(
      join(root, "app/api/ace/adaptive-case/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/adaptive_case_history/);
    expect(route).toMatch(/createServiceClient/);
    expect(route).toMatch(/exposure-derived current_step/);
    expect(route).toMatch(/stepIndex: path\.current_step/);
    const hook = readFileSync(join(root, "lib/ace/session-hook.ts"), "utf8");
    expect(hook).toMatch(/priorFingerprints/);
    expect(hook).toMatch(/preferAce/);
    expect(hook).toMatch(/createServiceClient/);
  });
});
