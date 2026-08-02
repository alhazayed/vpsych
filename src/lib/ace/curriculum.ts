import { scoreOf, SUICIDE_CURRICULUM_STEPS } from "./catalog";
import { generateAdaptiveCase } from "./adaptive";
import type {
  CompetencyId,
  CurriculumStep,
  LearnerProfile,
  LearningPath,
  LearningPlan,
} from "./types";

export function buildRemediationCurriculum(
  profile: LearnerProfile,
  focus: CompetencyId,
): LearningPath {
  let steps: CurriculumStep[] = [];

  if (focus === "suicide_assessment" || focus === "risk_assessment") {
    steps = SUICIDE_CURRICULUM_STEPS.map((s, index) => ({
      index,
      title: s.title,
      focus: ["suicide_assessment", "risk_assessment"] as CompetencyId[],
      diagnosis_slug: s.diagnosis,
      difficulty: s.difficulty,
      si_style: s.si_style,
      preset_slug: "suicide-risk-resident-en",
      time_limit_minutes: index >= 4 ? 30 : 40,
      completed: false,
    }));
  } else if (focus === "differential_diagnosis") {
    const diagnoses = [
      "mdd-recurrent-moderate",
      "gad-with-panic",
      "bipolar-mania",
      "adult-adhd",
      "ptsd",
    ];
    steps = diagnoses.map((d, index) => ({
      index,
      title: `Ambiguous presentation ${index + 1}`,
      focus: ["differential_diagnosis", "dsm5_reasoning"],
      diagnosis_slug: d,
      difficulty: index < 2 ? "intermediate" : "advanced",
      adaptations: [
        "diagnostic_ambiguity",
        "mixed_presentation",
        index >= 2 ? "comorbidity" : "rule_out",
      ],
      time_limit_minutes: 40,
      completed: false,
    }));
  } else {
    // Generic 5-step focus ladder
    const difficulties = [
      "beginner",
      "intermediate",
      "intermediate",
      "advanced",
      "advanced",
    ] as const;
    steps = difficulties.map((difficulty, index) => ({
      index,
      title: `${focus.replace(/_/g, " ")} — stage ${index + 1}`,
      focus: [focus],
      difficulty,
      adaptations: index >= 3 ? ["limited_disclosure", "resistance"] : [],
      time_limit_minutes: 40,
      completed: false,
    }));
  }

  return {
    id: `path-${profile.id}-${focus}`,
    learner_id: profile.id,
    slug: `auto-${focus}`,
    name: `Remediation: ${focus.replace(/_/g, " ")}`,
    focus_competency_id: focus,
    status: "active",
    steps,
    current_step: 0,
  };
}

export function generateCurriculum(profile: LearnerProfile): LearningPath {
  const threshold = profile.min_competency_threshold;
  const weak = [...profile.competencies]
    .filter((c) => c.score < threshold)
    .sort((a, b) => a.score - b.score)[0];

  const focus =
    (profile.required_competencies[0] as CompetencyId | undefined) ??
    weak?.competency_id ??
    "diagnostic_interview";

  return buildRemediationCurriculum(profile, focus);
}

export function advanceCurriculum(
  path: LearningPath,
  competencyScore: number,
  threshold: number,
): LearningPath {
  if (path.status !== "active") return path;
  const steps = path.steps.map((s) => ({ ...s }));
  const current = steps[path.current_step];
  if (!current) {
    return { ...path, status: "completed" };
  }

  if (competencyScore >= threshold) {
    current.completed = true;
    const next = path.current_step + 1;
    if (next >= steps.length) {
      return {
        ...path,
        steps,
        current_step: next,
        status: "completed",
      };
    }
    return { ...path, steps, current_step: next };
  }

  // Stay on step — do not infinite-loop by completing
  return { ...path, steps };
}

export function generateLearningPlan(profile: LearnerProfile): LearningPlan {
  const threshold = profile.min_competency_threshold;
  const weaknesses = [...profile.competencies]
    .filter((c) => c.score < threshold)
    .sort((a, b) => a.score - b.score);

  const primary = weaknesses[0]?.competency_id ?? null;
  const next_cases = [0, 1, 2].map((i) =>
    generateAdaptiveCase(profile, {
      seed: `plan:${profile.id}:${i}`,
      stepIndex: i,
      priorFingerprints: [],
    }),
  );

  // Ensure unique fingerprints in plan
  const seen = new Set<string>();
  for (const c of next_cases) {
    let fp = c.fingerprint;
    let n = 0;
    while (seen.has(fp)) {
      n += 1;
      fp = `${c.fingerprint}#plan${n}`;
    }
    c.fingerprint = fp;
    seen.add(fp);
  }

  const primaryScore = primary
    ? scoreOf(profile.competencies, primary)
    : threshold;
  const gap = Math.max(0, threshold - primaryScore);
  const estimated = Math.max(1, Math.ceil(gap / 8));

  return {
    learner_id: profile.id,
    primary_focus: primary,
    goals: [
      primary
        ? `Raise ${primary.replace(/_/g, " ")} above ${threshold}`
        : "Maintain competency across domains",
      ...weaknesses.slice(1, 3).map(
        (w) => `Strengthen ${w.competency_id.replace(/_/g, " ")} (now ${w.score})`,
      ),
    ],
    next_cases,
    reading: suggestedReading(primary),
    estimated_sessions_to_threshold: estimated,
  };
}

function suggestedReading(focus: CompetencyId | null): string[] {
  switch (focus) {
    case "suicide_assessment":
      return [
        "C-SSRS training guide",
        "SAFE-T pocket card",
        "APA Practice Guideline: Assessment of Patients With Suicidal Behaviors",
      ];
    case "differential_diagnosis":
      return [
        "DSM-5-TR differential diagnosis trees",
        "First Aid for the Psychiatry Clerkship — differentials",
      ];
    case "cbt_skills":
      return [
        "Beck — Cognitive Therapy of Depression (selected chapters)",
        "Padesky — Collaborative case conceptualization",
      ];
    default:
      return [
        "APA Practice Guidelines (relevant module)",
        "Clinical interviewing skills — structured MSE review",
      ];
  }
}
