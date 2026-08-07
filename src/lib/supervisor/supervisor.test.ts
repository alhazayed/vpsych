/**
 * Stage 9 Supervisor AI — unit, integration, educational, consistency, performance.
 */

import { describe, expect, it } from "vitest";
import { createLearnerProfile } from "@/lib/ace/engine";
import { analyzeInterviewProcess, evaluateSession } from "@/lib/education";
import {
  COMPETENCY_LEVEL_ORDER,
  THERAPIST_SKILL_DEFINITIONS,
  buildCompetencyProgression,
  buildExpertReview,
  buildReflectivePractice,
  buildSupervisorDashboard,
  clearSupervisorStoreForTests,
  detectModalities,
  evaluateTherapistSkills,
  generateLearningRecommendations,
  generateSupervisionFeedback,
  levelFromScore,
  runSupervisorEngine,
  storeSupervisorBundle,
  listSupervisorBundlesForUser,
  weightedTherapistOverall,
  SUPERVISOR_FORBIDDEN_WRITES,
  SUPERVISOR_OWNERSHIP_RULE,
  SUPERVISOR_VERSION,
} from "@/lib/supervisor";
import type { ScoreEntry } from "@/lib/types";
import type { QualityMetricsBundle } from "@/lib/validation/types";

const SAMPLE_ITEMS: ScoreEntry[] = [
  { id: "alliance", label: "Alliance", score: 8, max: 10, weight: 1, feedback: "solid bond" },
  { id: "risk_formulation", label: "Risk", score: 7, max: 10, weight: 1, feedback: "asked SI" },
  { id: "dsm_reasoning", label: "DSM", score: 6, max: 10, weight: 1, feedback: "partial" },
  { id: "structure", label: "Structure", score: 7, max: 10, weight: 1, feedback: "closed well" },
  { id: "interventions", label: "Tx", score: 5, max: 10, weight: 1, feedback: "thin plan" },
];

const GOOD_MSGS = [
  { role: "user", content: "How have you been feeling this week?" },
  { role: "assistant", content: "Exhausted." },
  {
    role: "user",
    content: "It sounds like this has been exhausting — did I get that right?",
  },
  { role: "assistant", content: "Yeah." },
  {
    role: "user",
    content:
      "That makes sense given everything you've described. When things feel this heavy, do you ever have thoughts of ending your life?",
  },
  { role: "assistant", content: "Sometimes, passively." },
  {
    role: "user",
    content:
      "To summarize, low mood and some passive SI. Before we finish, what feels most important as a next step? We could try a thought record as homework if you're willing.",
  },
];

const WEAK_MSGS = [
  { role: "user", content: "You should just exercise more." },
  { role: "assistant", content: "Okay…" },
  { role: "user", content: "Did you sleep?" },
  { role: "assistant", content: "Not really." },
  { role: "user", content: "Why didn't you take your meds?" },
];

function stubProfile() {
  return createLearnerProfile({
    user_id: "u-sup-1",
    id: "lp-sup-1",
    training_level: "residency",
    profession: "psychiatry_resident",
  });
}

describe("supervisor competency framework", () => {
  it("defines 20 therapist skills with weights summing ~100", () => {
    expect(THERAPIST_SKILL_DEFINITIONS).toHaveLength(20);
    const sum = THERAPIST_SKILL_DEFINITIONS.reduce((a, d) => a + d.weight, 0);
    expect(sum).toBeGreaterThanOrEqual(95);
    expect(sum).toBeLessThanOrEqual(105);
  });

  it("maps scores to Dreyfus levels", () => {
    expect(levelFromScore(20)).toBe("novice");
    expect(levelFromScore(50)).toBe("advanced_beginner");
    expect(levelFromScore(70)).toBe("competent");
    expect(levelFromScore(80)).toBe("proficient");
    expect(levelFromScore(90)).toBe("expert");
    expect(levelFromScore(96)).toBe("master");
    expect(COMPETENCY_LEVEL_ORDER).toHaveLength(6);
  });
});

describe("therapist evaluation + modality detection", () => {
  it("scores skills with transcript evidence", () => {
    const process = analyzeInterviewProcess(GOOD_MSGS);
    const scores = evaluateTherapistSkills({
      messages: GOOD_MSGS,
      items: SAMPLE_ITEMS,
      overall: 72,
      process,
    });
    expect(scores).toHaveLength(20);
    const risk = scores.find((s) => s.id === "risk_assessment")!;
    expect(risk.score).toBeGreaterThan(50);
    expect(risk.evidence.length).toBeGreaterThan(0);
    expect(risk.evidence[0]!.excerpt.length).toBeGreaterThan(0);
  });

  it("detects CBT markers without forcing modality", () => {
    const detected = detectModalities({
      messages: GOOD_MSGS,
      caseModality: "cbt",
    });
    const cbt = detected.find((d) => d.modality === "cbt");
    expect(cbt).toBeTruthy();
    expect(cbt!.matches_case_modality).toBe(true);
  });

  it("returns unknown when no modality markers exist", () => {
    const detected = detectModalities({
      messages: [
        { role: "user", content: "Hello." },
        { role: "assistant", content: "Hi." },
      ],
    });
    expect(detected[0]!.modality).toBe("unknown");
  });
});

describe("supervisor engine integration", () => {
  it("builds a full supervision bundle grounded in session events", () => {
    const profile = stubProfile();
    const evaluation = evaluateSession({
      sessionId: "sess-sup-1",
      overall: 72,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
      aceCompetencies: profile.competencies,
    });

    const bundle = runSupervisorEngine({
      sessionId: "sess-sup-1",
      userId: "u-sup-1",
      overall: 72,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
      diagnosisSlug: "major-depressive-disorder",
      clinicalSnapshot: {
        primary_diagnosis: {
          slug: "major-depressive-disorder",
          name: "Major depressive disorder",
          dsm5_code: "296.23",
          icd11_code: "6A70",
        },
        clinical_teaching: {
          differentials: ["persistent-depressive-disorder"],
          teaching_points: ["Ask about SI early"],
          common_mistakes: ["Premature advice"],
        },
        therapy_modality: "cbt",
      },
      learnerProfile: profile,
      educationEvaluation: evaluation,
      validationRun: {
        id: "val-1",
        session_id: "sess-sup-1",
        study_id: null,
        created_at: new Date().toISOString(),
        realism: {
          overall: 70,
          dimensions: [],
          confidence_interval: {
            lower: 60,
            upper: 80,
            level: 0.95,
            method: "test",
          },
        },
        dsm: { overall: 70, dimensions: [] },
        consistency: { overall: 70, dimensions: [] },
        reliability: { overall: null, inter_rater: [], notes: [] },
        psychometrics: [],
        metrics: {
          realism_index: 70,
          consistency_index: 70,
          clinical_fidelity: 68,
          memory_integrity: 60,
          diagnostic_stability: 65,
          conversation_quality: 72,
          alliance_score: 50,
          behaviour_stability: 66,
          decision_stability: 64,
          session_quality: 48,
        } satisfies QualityMetricsBundle,
        benchmarks: [],
        longitudinal: [],
        audits: [],
        versions: {
          validation_version: "1.0.0",
          framework_version: 1,
          algorithm_version: "1.0.0",
          assessment_schema_version: null,
          prompt_version: null,
          computed_at: new Date().toISOString(),
        },
        observational: true,
        patient_state_modified: false,
      },
    });

    expect(bundle.supervisor_version).toBe(SUPERVISOR_VERSION);
    expect(bundle.expert_review.skill_scores).toHaveLength(20);
    expect(bundle.feedback.beginner.band).toBe("beginner");
    expect(bundle.feedback.board.band).toBe("board");
    expect(bundle.feedback.primary.band).toBeTruthy();
    expect(bundle.competencies.heatmap).toHaveLength(20);
    expect(bundle.recommendations.length).toBeGreaterThan(0);
    expect(bundle.reflective.reflection_questions.length).toBeGreaterThan(2);
    expect(bundle.expert_review.session_review.dsm_references.length).toBeGreaterThan(0);
    expect(bundle.expert_review.session_review.icd_references.length).toBeGreaterThan(0);
    // Stage 8 metrics used
    expect(
      bundle.recommendations.some((r) => r.id.includes("validation")),
    ).toBe(true);
    // No invented diagnosis — case key only
    expect(bundle.expert_review.domain_reports.find((d) => d.domain === "dsm")!.findings.join(" ")).toMatch(
      /never invents|educational|teaching/i,
    );
  });

  it("produces weaker risk scores when SI is omitted", () => {
    const review = buildExpertReview({
      sessionId: "sess-weak",
      userId: "u",
      overall: 40,
      items: SAMPLE_ITEMS.map((i) =>
        i.id.includes("risk") ? { ...i, score: 2 } : i,
      ),
      messages: WEAK_MSGS,
    });
    const risk = review.skill_scores.find((s) => s.id === "risk_assessment")!;
    expect(risk.score).toBeLessThan(50);
    const good = buildExpertReview({
      sessionId: "sess-good",
      userId: "u",
      overall: 72,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
    });
    const goodRisk = good.skill_scores.find((s) => s.id === "risk_assessment")!;
    expect(goodRisk.score).toBeGreaterThan(risk.score);
  });
});

describe("supervisor consistency + educational invariants", () => {
  it("is deterministic for identical inputs", () => {
    const input = {
      sessionId: "sess-det",
      userId: "u",
      overall: 70,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
      learnerProfile: stubProfile(),
    };
    const a = runSupervisorEngine(input);
    const b = runSupervisorEngine(input);
    expect(weightedTherapistOverall(a.expert_review.skill_scores)).toBe(
      weightedTherapistOverall(b.expert_review.skill_scores),
    );
    expect(a.competencies.overall_level).toBe(b.competencies.overall_level);
    expect(a.feedback.primary.band).toBe(b.feedback.primary.band);
  });

  it("ownership strings forbid patient-state writes", () => {
    expect(SUPERVISOR_OWNERSHIP_RULE).toMatch(/observes only/i);
    expect(SUPERVISOR_FORBIDDEN_WRITES).toContain("clinical_snapshot");
    expect(SUPERVISOR_FORBIDDEN_WRITES).toContain("DecisionPlan");
    expect(SUPERVISOR_FORBIDDEN_WRITES).toContain("Clinical Intelligence");
  });

  it("reflective practice never invents differentials without teaching key", () => {
    const review = buildExpertReview({
      sessionId: "s",
      userId: "u",
      overall: 50,
      items: SAMPLE_ITEMS,
      messages: WEAK_MSGS,
    });
    const reflective = buildReflectivePractice({ review });
    expect(reflective.alternative_hypotheses.join(" ")).toMatch(
      /do not invent|No case teaching/i,
    );
  });

  it("feedback bands all present", () => {
    const review = buildExpertReview({
      sessionId: "s",
      userId: "u",
      overall: 70,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
      learnerProfile: stubProfile(),
    });
    const pack = generateSupervisionFeedback(review, stubProfile());
    expect(pack.beginner.next_actions.length).toBeGreaterThan(0);
    expect(pack.consultant.expectations.length).toBeGreaterThan(0);
    expect(pack.board.expectations.join(" ")).toMatch(/Board-level|board/i);
  });
});

describe("portfolio store + dashboard", () => {
  it("stores bundles and builds dashboard", () => {
    clearSupervisorStoreForTests();
    const bundle = runSupervisorEngine({
      sessionId: "sess-store-1",
      userId: "u-store",
      overall: 68,
      items: SAMPLE_ITEMS,
      messages: GOOD_MSGS,
      learnerProfile: stubProfile(),
    });
    storeSupervisorBundle("u-store", bundle);
    expect(listSupervisorBundlesForUser("u-store")).toHaveLength(1);
    const dash = buildSupervisorDashboard({ bundle });
    expect(dash.competency_heatmap.length).toBe(20);
    expect(dash.certification_tracker.progress_pct).toBeGreaterThanOrEqual(0);
    expect(dash.quality_gate_notes.join(" ")).toMatch(/never/i);
  });
});

describe("performance smoke", () => {
  it("runs 100 supervisor engines under 2s", () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      runSupervisorEngine({
        sessionId: `perf-${i}`,
        userId: "u-perf",
        overall: 60 + (i % 20),
        items: SAMPLE_ITEMS,
        messages: i % 2 === 0 ? GOOD_MSGS : WEAK_MSGS,
      });
    }
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("regression: competency progression + recommendations", () => {
  it("progression entries map every skill to evidence", () => {
    const scores = evaluateTherapistSkills({
      messages: GOOD_MSGS,
      items: SAMPLE_ITEMS,
      overall: 70,
      process: analyzeInterviewProcess(GOOD_MSGS),
    });
    const prog = buildCompetencyProgression(scores);
    expect(prog.entries.every((e) => e.evidence.length > 0)).toBe(true);
    expect(prog.entries.every((e) => e.next_level_criteria.length > 0)).toBe(
      true,
    );
  });

  it("learning recommendations cite evidence", () => {
    const review = buildExpertReview({
      sessionId: "s",
      userId: "u",
      overall: 45,
      items: SAMPLE_ITEMS,
      messages: WEAK_MSGS,
    });
    const recs = generateLearningRecommendations(review);
    expect(recs.every((r) => r.evidence.length > 0 || r.rationale.length > 0)).toBe(
      true,
    );
  });
});
