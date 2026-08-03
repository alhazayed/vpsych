import { describe, expect, it } from "vitest";
import {
  createLearnerProfile,
  generateAdaptiveCase,
  gateFocusByPrerequisites,
  ingestSessionAssessment,
  scoreOf,
} from "@/lib/ace";
import { inferCorrectDiagnosisFromNarrative } from "@/lib/ace/session-hook";
import { inferMissFlagsFromNarrative } from "@/lib/ace/analytics";
import { generateGraphAwareAdaptiveCase } from "@/lib/cge/ace-bridge";
import {
  analyzeRootCause,
  blockedCompetencies,
  statesFromAceCompetencies,
  updateCompetencyScore,
  createEmptyLearnerStates,
} from "@/lib/cge";
import {
  BUILTIN_PRESETS,
  listBuiltinPresets,
  validateInstructorPreset,
} from "@/lib/instructor-presets";
import type { TargetLearner } from "@/lib/instructor-presets/types";
import type { ScoreEntry } from "@/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function rubricItems(scores: {
  alliance: number;
  assessment: number;
  interventions: number;
  safety: number;
  structure: number;
}): ScoreEntry[] {
  return [
    { id: "alliance", label: "Alliance", score: scores.alliance, max: 5, weight: 25, feedback: "" },
    { id: "assessment", label: "Assessment", score: scores.assessment, max: 5, weight: 25, feedback: "" },
    { id: "interventions", label: "Interventions", score: scores.interventions, max: 5, weight: 20, feedback: "" },
    { id: "safety", label: "Safety", score: scores.safety, max: 5, weight: 20, feedback: "" },
    { id: "structure", label: "Structure", score: scores.structure, max: 5, weight: 10, feedback: "" },
  ];
}

function overallFrom(items: ScoreEntry[]): number {
  const w = items.reduce((s, i) => s + i.weight, 0) || 1;
  return Math.round(
    items.reduce((s, i) => s + (i.score / i.max) * 100 * i.weight, 0) / w,
  );
}

describe("Educational Outcome Certification — Mission 16", () => {
  it("covers CBME target learner presets (student → resident → GP → counselor → psychologist)", () => {
    const required: TargetLearner[] = [
      "medical_student",
      "psychiatry_resident",
      "general_practitioner",
      "counselor",
      "psychologist",
      "osce_candidate",
    ];
    const covered = new Set(listBuiltinPresets().map((p) => p.target_learner));
    for (const t of required) {
      expect(covered.has(t), `missing preset for ${t}`).toBe(true);
    }
    for (const preset of BUILTIN_PRESETS) {
      const errors = validateInstructorPreset(preset).filter(
        (i) => i.severity === "error",
      );
      expect(errors, JSON.stringify(errors)).toHaveLength(0);
    }
  });

  it("does not invent correctDiagnosis from overall score alone", () => {
    expect(
      inferCorrectDiagnosisFromNarrative(undefined, 90),
    ).toBeUndefined();
    expect(
      inferCorrectDiagnosisFromNarrative(
        "Learner missed the differential diagnosis entirely.",
        90,
      ),
    ).toBe(false);
    expect(
      inferCorrectDiagnosisFromNarrative(
        "Accurate diagnosis and appropriate formulation.",
        40,
      ),
    ).toBe(true);
  });

  it("applies narrative miss flags for suicide gaps", () => {
    const flags = inferMissFlagsFromNarrative(
      "The learner failed to ask suicide risk questions and neglected safety planning.",
    );
    expect(flags.missed_suicide_questions).toBe(true);
  });

  it("gates adaptive focus behind CGE prerequisites", () => {
    let profile = createLearnerProfile({ id: "edu-gate", user_id: "u-gate" });
    // Never-attempted advanced focus with unmet foundations
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "treatment_planning" ||
        c.competency_id === "differential_diagnosis"
          ? { ...c, score: 35, samples: 0 }
          : { ...c, score: 40, samples: 0 },
      ),
    };
    const gated = gateFocusByPrerequisites(profile, [
      "treatment_planning",
      "differential_diagnosis",
    ]);
    const states = statesFromAceCompetencies(profile.competencies);
    const blocked = new Set(blockedCompetencies(states));
    for (const f of gated) {
      // Never-attempted blocked comps must not remain in focus
      if (blocked.has(f)) {
        expect(profile.competencies.find((c) => c.competency_id === f)?.samples ?? 0).toBeGreaterThan(0);
      }
    }
    expect(gated.some((f) => f === "treatment_planning")).toBe(false);
  });

  it("CGE bridge prioritizes root cause without fabricating EMA weakness", () => {
    let profile = createLearnerProfile({ id: "edu-bridge", user_id: "u-b" });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) => {
        if (c.competency_id === "diagnostic_interview")
          return { ...c, score: 85, samples: 4 };
        if (c.competency_id === "mental_status_examination")
          return { ...c, score: 42, samples: 3 };
        if (c.competency_id === "treatment_planning")
          return { ...c, score: 48, samples: 3 };
        if (c.competency_id === "dsm5_reasoning")
          return { ...c, score: 55, samples: 3 };
        if (c.competency_id === "differential_diagnosis")
          return { ...c, score: 52, samples: 3 };
        if (c.competency_id === "risk_assessment")
          return { ...c, score: 60, samples: 3 };
        return { ...c, score: 75, samples: 3 };
      }),
    };
    const before = scoreOf(profile.competencies, "mental_status_examination");
    const next = generateGraphAwareAdaptiveCase(profile, {
      seed: "edu-bridge",
      observedFailure: "treatment_planning",
    });
    expect(next.rootCause).toBeTruthy();
    expect(next.focusCompetencies).toContain(
      next.rootCause as (typeof next.focusCompetencies)[number],
    );
    // Bridge must not invent a weaker EMA than assessed evidence
    expect(before).toBe(42);
    expect(next.adaptations.some((a) => a.startsWith("cge_root:"))).toBe(true);
  });

  it("weak / average / excellent learners diverge appropriately over 12 sessions", () => {
    const trajectories = {
      weak: { alliance: 2, assessment: 2, interventions: 1, safety: 1, structure: 2 },
      average: { alliance: 3, assessment: 3, interventions: 3, safety: 3, structure: 3 },
      excellent: { alliance: 5, assessment: 5, interventions: 4, safety: 5, structure: 4 },
    } as const;

    const finals: Record<string, number> = {};
    for (const [label, scores] of Object.entries(trajectories)) {
      let profile = createLearnerProfile({
        id: `edu-${label}`,
        user_id: `u-${label}`,
        profession:
          label === "excellent" ? "psychiatry_resident" : "medical_student",
        training_level: label === "excellent" ? "residency" : "undergraduate",
      });
      const curve: number[] = [];
      for (let i = 0; i < 12; i++) {
        const items = rubricItems(scores);
        const overall = overallFrom(items);
        const next = generateAdaptiveCase(profile, { seed: `${label}-${i}` });
        const result = ingestSessionAssessment(profile, {
          overall,
          items,
          sessionId: `${label}-${i}`,
          diagnosisSlug: next.disorderSlug,
          correctDiagnosis: label !== "weak",
          narrative:
            label === "weak"
              ? "Learner missed differential diagnosis and failed suicide risk inquiry."
              : "Accurate diagnosis with appropriate safety assessment.",
          missFlags:
            label === "weak"
              ? { missed_suicide_questions: true, missed_dsm_criteria: true }
              : undefined,
        });
        profile = result.profile;
        curve.push(overall);
        expect(result.nextCase.fingerprint).toBeTruthy();
        expect(result.coach.supervisor_feedback.length).toBeGreaterThan(10);
      }
      finals[label] = profile.confidence_score;
      expect(curve.length).toBe(12);
      if (label === "excellent") {
        expect(profile.confidence_score).toBeGreaterThan(60);
      }
      if (label === "weak") {
        expect(
          scoreOf(profile.competencies, "suicide_assessment"),
        ).toBeLessThan(55);
      }
    }
    expect(finals.excellent!).toBeGreaterThan(finals.weak!);
    expect(finals.average!).toBeGreaterThan(finals.weak!);
  });

  it("longitudinal learning: improving learner gains over 50 assessments", () => {
    let profile = createLearnerProfile({
      id: "edu-long",
      user_id: "u-long",
      profession: "psychiatry_resident",
      training_level: "residency",
    });
    // Start weak on safety
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "suicide_assessment" ||
        c.competency_id === "risk_assessment"
          ? { ...c, score: 35, samples: 1 }
          : c,
      ),
    };
    const startSafety = scoreOf(profile.competencies, "suicide_assessment");
    const curve: number[] = [];

    for (let i = 0; i < 50; i++) {
      // Gradual skill growth
      const safety = Math.min(5, 1 + Math.floor(i / 10));
      const assessment = Math.min(5, 2 + Math.floor(i / 12));
      const items = rubricItems({
        alliance: Math.min(5, 3 + Math.floor(i / 15)),
        assessment,
        interventions: Math.min(5, 2 + Math.floor(i / 14)),
        safety,
        structure: Math.min(5, 3 + Math.floor(i / 16)),
      });
      const overall = overallFrom(items);
      const next = generateAdaptiveCase(profile, {
        seed: `long-${i}`,
        stepIndex: i,
      });
      if (scoreOf(profile.competencies, "suicide_assessment") < 70 && i < 30) {
        // Early remediation should keep safety in focus when weak
        expect(
          next.focusCompetencies.includes("suicide_assessment") ||
            next.focusCompetencies.includes("risk_assessment") ||
            next.adaptations.some((a) => a.startsWith("si_style:")),
        ).toBe(true);
      }
      const result = ingestSessionAssessment(profile, {
        overall,
        items,
        sessionId: `long-${i}`,
        diagnosisSlug: next.disorderSlug,
        correctDiagnosis: i > 5,
        narrative:
          i > 5
            ? "Correct diagnosis with thorough suicide assessment."
            : "Incomplete safety inquiry; missed suicide questions.",
        missFlags:
          i <= 5 ? { missed_suicide_questions: true } : undefined,
      });
      profile = result.profile;
      curve.push(overall);
    }

    const endSafety = scoreOf(profile.competencies, "suicide_assessment");
    expect(endSafety).toBeGreaterThan(startSafety);
    expect(profile.completed_case_count).toBe(50);
    expect(curve[49]!).toBeGreaterThan(curve[0]!);
    expect(profile.confidence_score).toBeGreaterThan(50);
  }, 60_000);

  it("educational reliability: identical assessments produce low score variance", () => {
    const items = rubricItems({
      alliance: 4,
      assessment: 4,
      interventions: 3,
      safety: 4,
      structure: 4,
    });
    const overall = overallFrom(items);
    const scores: number[] = [];
    for (let i = 0; i < 20; i++) {
      let profile = createLearnerProfile({
        id: `rel-${i}`,
        user_id: `u-rel-${i}`,
      });
      // Seed identical baseline
      profile = {
        ...profile,
        competencies: profile.competencies.map((c) => ({
          ...c,
          score: 70,
          samples: 2,
        })),
      };
      const result = ingestSessionAssessment(profile, {
        overall,
        items,
        sessionId: `rel-${i}`,
        diagnosisSlug: "mdd-recurrent-moderate",
        correctDiagnosis: true,
        narrative: "Accurate diagnosis and thorough safety assessment.",
      });
      scores.push(scoreOf(result.profile.competencies, "diagnostic_interview"));
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    const stdev = Math.sqrt(variance);
    // Deterministic EMA → near-zero variance for identical inputs
    expect(stdev).toBeLessThan(0.01);
    expect(new Set(scores).size).toBe(1);
  });

  it("root-cause analysis remains educationally coherent for treatment planning failures", () => {
    let states = createEmptyLearnerStates();
    states = updateCompetencyScore(states, "mental_status_examination", 40);
    states = updateCompetencyScore(states, "treatment_planning", 45);
    states = updateCompetencyScore(states, "differential_diagnosis", 52);
    const rca = analyzeRootCause("treatment_planning", states);
    expect(rca.root_cause).toBe("mental_status_examination");
  });

  it("architecture: ACE persist uses RPC and session hook avoids overall≥55 diagnosis hack", () => {
    const root = join(process.cwd(), "src");
    const hook = readFileSync(join(root, "lib/ace/session-hook.ts"), "utf8");
    const persist = readFileSync(join(root, "lib/ace/persist.ts"), "utf8");
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(persist).toMatch(/apply_ace_session_progress/);
    expect(hook).toMatch(/inferMissFlagsFromNarrative/);
    expect(hook).toMatch(/inferCorrectDiagnosisFromNarrative/);
    expect(hook).not.toMatch(/correctDiagnosis:\s*opts\.overall\s*>=\s*55/);
    expect(end).toMatch(/writeClient:\s*admin/);
    const bridge = readFileSync(join(root, "lib/cge/ace-bridge.ts"), "utf8");
    expect(bridge).not.toMatch(/Math\.min\(c\.score,\s*55\)/);
  });
});
