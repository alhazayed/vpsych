/**
 * Stage 7 education package — unit, integration, longitudinal, performance.
 */

import { describe, expect, it } from "vitest";
import { createEmptyCompetencies, createLearnerProfile } from "@/lib/ace/engine";
import {
  EDUCATION_COMPETENCY_DEFINITIONS,
  EDUCATION_FRAMEWORK_VERSION,
  EDUCATION_VERSION,
  analyzeInterviewProcess,
  buildClinicalReasoningGraph,
  buildDiagnosticReasoningReport,
  buildDifficultyProfile,
  buildEducationAnalytics,
  buildEducationSessionBundle,
  buildExpertFeedback,
  buildTraineePortfolio,
  caseDifficultyForLevel,
  evaluateCertificationMilestone,
  evaluateSession,
  expertLevelFromAce,
  generateEducationCurriculum,
  microSkillsFor,
  milestoneRank,
  projectLongitudinalLearning,
  scoreEducationCompetencies,
  simulateLearnerArc,
  teachingPlanFromFeedback,
  weightedEducationOverall,
} from "@/lib/education";
import type { ScoreEntry } from "@/lib/types";

const SAMPLE_ITEMS: ScoreEntry[] = [
  { id: "empathy", label: "Empathy", score: 7, max: 10, weight: 1, feedback: "ok" },
  {
    id: "risk_formulation",
    label: "Risk",
    score: 4,
    max: 10,
    weight: 1,
    feedback: "thin",
  },
  {
    id: "differential_diagnosis",
    label: "Diff",
    score: 5,
    max: 10,
    weight: 1,
    feedback: "partial",
  },
  {
    id: "dsm_reasoning",
    label: "DSM",
    score: 6,
    max: 10,
    weight: 1,
    feedback: "ok",
  },
  {
    id: "icd_reasoning",
    label: "ICD",
    score: 6,
    max: 10,
    weight: 1,
    feedback: "ok",
  },
];

const THERAPIST_MSGS = [
  { role: "user", content: "How have you been feeling this week?" },
  { role: "assistant", content: "Tired mostly." },
  {
    role: "user",
    content: "It sounds like this has been exhausting — did I get that right?",
  },
  { role: "assistant", content: "Yeah." },
  {
    role: "user",
    content:
      "When things feel this heavy, do you ever have thoughts of ending your life?",
  },
  { role: "assistant", content: "Sometimes." },
  {
    role: "user",
    content: "To summarize, low mood and some passive SI. Before we finish, what feels most important next?",
  },
];

function stubProfile(overrides?: Partial<ReturnType<typeof createLearnerProfile>>) {
  return createLearnerProfile({
    user_id: "u-edu-1",
    id: "lp-edu-1",
    training_level: "residency",
    profession: "psychiatry_resident",
    ...overrides,
  });
}

describe("education competency framework", () => {
  it("defines 20 weighted domains summing near 100", () => {
    expect(EDUCATION_COMPETENCY_DEFINITIONS).toHaveLength(20);
    const sum = EDUCATION_COMPETENCY_DEFINITIONS.reduce((a, d) => a + d.weight, 0);
    expect(sum).toBe(100);
    for (const d of EDUCATION_COMPETENCY_DEFINITIONS) {
      expect(d.version).toBe(EDUCATION_FRAMEWORK_VERSION);
      expect(d.ace_competencies.length).toBeGreaterThan(0);
    }
  });

  it("scores domains from ACE competencies without forking assessment SSOT", () => {
    const comps = createEmptyCompetencies().map((c) =>
      ["risk_assessment", "suicide_assessment", "violence_assessment"].includes(
        c.competency_id,
      )
        ? { ...c, score: 40, samples: 4 }
        : { ...c, score: 72, samples: 4 },
    );
    const scores = scoreEducationCompetencies(comps);
    expect(scores).toHaveLength(20);
    const risk = scores.find((s) => s.id === "risk_assessment");
    expect(risk!.score).toBeLessThan(50);
    const overall = weightedEducationOverall(scores);
    expect(overall).toBeGreaterThan(40);
    expect(overall).toBeLessThan(90);
  });
});

describe("session evaluation", () => {
  it("detects open questions, reflection, risk, and closure", () => {
    const process = analyzeInterviewProcess(THERAPIST_MSGS);
    expect(process.open_question_count).toBeGreaterThan(0);
    expect(process.reflection_count).toBeGreaterThan(0);
    expect(process.risk_inquiry_present).toBe(true);
    expect(process.closure_present).toBe(true);
  });

  it("flags missing risk as critical", () => {
    const report = evaluateSession({
      sessionId: "s1",
      overall: 55,
      items: SAMPLE_ITEMS,
      messages: [
        { role: "user", content: "Are you sleeping?" },
        { role: "assistant", content: "Not really." },
        { role: "user", content: "You should just exercise more." },
        { role: "assistant", content: "Ok." },
        { role: "user", content: "Don't you think that would help?" },
        { role: "assistant", content: "Maybe." },
        { role: "user", content: "Just try harder." },
      ],
    });
    expect(report.findings.some((f) => f.id === "missed-risk")).toBe(true);
    expect(report.missed_opportunities).toContain("Risk assessment inquiry");
    expect(report.coverage.risk).toBeLessThan(50);
  });
});

describe("clinical / diagnostic reasoning", () => {
  const snap = {
    primary_diagnosis: {
      slug: "mdd-recurrent-moderate",
      name: "Major Depressive Disorder",
      dsm5_code: "296.32",
      icd11_code: "6A71.1",
    },
    clinical_core: {
      symptom_profile: [
        { id: "anhedonia", description: "Loss of interest", salience: "presenting" },
        { id: "si", description: "Passive SI", salience: "elicited" },
      ],
      risk_profile: { suicidal_ideation: "passive" },
      protective_factors: [{ id: "kids", label: "Children at home" }],
    },
    clinical_teaching: {
      differentials: ["Bipolar depression", "Adjustment disorder"],
      rule_outs: ["Substance-induced mood"],
      teaching_points: ["Screen for hypomania"],
      common_mistakes: ["Closing on MDD without bipolar screen"],
    },
  };

  it("builds a grounded reasoning graph without inventing diagnosis", () => {
    const graph = buildClinicalReasoningGraph({
      clinicalSnapshot: snap,
      items: SAMPLE_ITEMS,
      overall: 60,
    });
    expect(graph.nodes.some((n) => n.id === "dx-primary")).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "symptom")).toBe(true);
    expect(graph.narrative.join(" ")).toMatch(/does not invent/i);
  });

  it("produces supported/alternative/missing evidence from case key", () => {
    const dx = buildDiagnosticReasoningReport({
      clinicalSnapshot: snap,
      items: SAMPLE_ITEMS,
      overall: 60,
    });
    expect(dx.case_primary_slug).toBe("mdd-recurrent-moderate");
    expect(dx.supported_diagnoses[0]?.slug).toBe("mdd-recurrent-moderate");
    expect(dx.alternative_diagnoses.length).toBeGreaterThan(0);
    expect(dx.missing_evidence.length).toBeGreaterThan(0);
    expect(dx.next_interview_questions.length).toBeGreaterThan(0);
  });
});

describe("difficulty + certification", () => {
  it("maps expert levels onto case difficulty", () => {
    expect(expertLevelFromAce("undergraduate", "medical_student")).toBe(
      "medical_student",
    );
    expect(caseDifficultyForLevel("medical_student")).toBe("beginner");
    expect(caseDifficultyForLevel("expert_psychiatrist")).toBe("expert");
    const profile = buildDifficultyProfile(stubProfile());
    expect(profile.learner_level).toBe("senior_resident");
    expect(profile.comorbidity_weight).toBeGreaterThan(0);
  });

  it("never inflates milestones for thin samples", () => {
    const p = stubProfile();
    p.completed_case_count = 1;
    p.competencies = createEmptyCompetencies();
    const m = evaluateCertificationMilestone(p);
    expect(m.milestone).toBe("beginner");
    expect(milestoneRank(m.milestone)).toBe(0);
  });
});

describe("curriculum feedback portfolio analytics", () => {
  it("composes ACE/CGE curriculum and expert feedback", () => {
    const profile = stubProfile();
    profile.completed_case_count = 5;
    const evaluation = evaluateSession({
      sessionId: "s2",
      overall: 62,
      items: SAMPLE_ITEMS,
      messages: THERAPIST_MSGS,
      aceCompetencies: profile.competencies,
    });
    const diagnostic = buildDiagnosticReasoningReport({
      clinicalSnapshot: null,
      items: SAMPLE_ITEMS,
      overall: 62,
    });
    const feedback = buildExpertFeedback({
      evaluation,
      diagnostic,
      coach: null,
    });
    expect(feedback.priority_improvements.length).toBeGreaterThan(0);
    expect(feedback.suggested_wording.length).toBeGreaterThan(0);

    const plan = generateEducationCurriculum(profile, feedback);
    expect(plan.ace_path.steps.length).toBeGreaterThan(0);
    expect(plan.next_case.difficulty).toBeTruthy();
    expect(microSkillsFor(["risk_assessment"]).length).toBeGreaterThan(0);
    expect(teachingPlanFromFeedback(feedback).length).toBeGreaterThan(0);

    const portfolio = buildTraineePortfolio({
      profile,
      diagnosesPracticed: ["mdd-recurrent-moderate"],
      recommendations: feedback.priority_improvements,
    });
    expect(portfolio.version).toBe(EDUCATION_FRAMEWORK_VERSION);
    expect(portfolio.competencies).toHaveLength(20);

    const analytics = buildEducationAnalytics({ profile, evaluation });
    expect(analytics.competency_radar).toHaveLength(20);
    expect(analytics.interview_completeness).toBeGreaterThan(0);
  });
});

describe("education session bundle", () => {
  it("assembles evaluation + reasoning + feedback without patient writes", () => {
    const bundle = buildEducationSessionBundle({
      sessionId: "s3",
      userId: "u1",
      overall: 70,
      items: SAMPLE_ITEMS,
      messages: THERAPIST_MSGS,
      clinicalSnapshot: {
        primary_diagnosis: {
          slug: "gad",
          name: "GAD",
        },
        clinical_teaching: { differentials: ["Panic disorder"] },
      },
      learnerProfile: stubProfile(),
    });
    expect(bundle.version).toBe(EDUCATION_FRAMEWORK_VERSION);
    expect(bundle.evaluation.education_version).toBe(EDUCATION_VERSION);
    expect(bundle.milestone).toBeTruthy();
    expect(bundle.feedback.coach).toBeTruthy();
  });
});

describe("longitudinal learner simulation", () => {
  it("projects 10/25/50/100 horizons and simulates a 100-session arc", () => {
    const profile = stubProfile();
    profile.completed_case_count = 12;
    profile.learning_velocity = 0.5;
    profile.competencies = createEmptyCompetencies().map((c) => ({
      ...c,
      score: 68,
      samples: 5,
    }));
    const proj = projectLongitudinalLearning(profile, 100);
    expect(proj.points.length).toBeGreaterThan(5);
    expect(proj.horizon).toBe(100);

    const sim = simulateLearnerArc({ sessions: 100, startOverall: 40, velocity: 0.6 });
    expect(sim.points).toHaveLength(101);
    const last = sim.points[sim.points.length - 1]!;
    expect(last.overall_ema).toBeGreaterThan(40);
    expect(milestoneRank(last.milestone)).toBeGreaterThanOrEqual(
      milestoneRank("intermediate"),
    );
  });
});

describe("education performance smoke", () => {
  it("evaluates 200 synthetic sessions under 2s", () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      evaluateSession({
        sessionId: `perf-${i}`,
        overall: 50 + (i % 40),
        items: SAMPLE_ITEMS,
        messages: THERAPIST_MSGS,
      });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
