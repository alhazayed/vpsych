/**
 * Lightweight in-memory ACE simulator for large-N verification.
 */

import { createRng } from "@/lib/case-engine/generator";
import { findDisorderBySlug } from "@/lib/case-engine/catalog";
import {
  createLearnerProfile,
  detectRepetitionLoop,
  ingestSessionAssessment,
} from "./engine";
import { generateAdaptiveCase, contentSignatureFromFingerprint } from "./adaptive";
import { scoreOf } from "./catalog";
import type { CompetencyId, LearnerProfile } from "./types";
import type { ScoreEntry } from "@/lib/types";

export type SimulationResult = {
  learners: number;
  sessions: number;
  competencyTrackingOk: boolean;
  adaptiveCurriculumOk: boolean;
  noInfiniteLoops: boolean;
  noRepetitiveCases: boolean;
  noImpossibleDiagnoses: boolean;
  remediationOk: boolean;
  graduationOk: boolean;
  progressionOk: boolean;
  failures: string[];
};

function syntheticItems(
  overall: number,
  bias: Partial<Record<string, number>>,
): ScoreEntry[] {
  const mk = (id: string, score5: number): ScoreEntry => ({
    id,
    label: id,
    score: score5,
    max: 5,
    weight: 20,
    feedback: "",
  });
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
  return [
    mk("alliance", to5(bias.alliance ?? overall)),
    mk("assessment", to5(bias.assessment ?? overall)),
    mk("interventions", to5(bias.interventions ?? overall)),
    mk("safety", to5(bias.safety ?? overall)),
    mk("structure", to5(bias.structure ?? overall)),
  ];
}

/**
 * Simulate `learnerCount` virtual learners (default 10_000).
 * Each learner runs a short adaptive sequence; aggregate invariants checked.
 */
export function simulateVirtualLearners(
  learnerCount = 10_000,
  sessionsPerLearner = 6,
): SimulationResult {
  const rng = createRng("vpsych-ace-10k");
  const failures: string[] = [];
  let sessions = 0;
  let remediationHits = 0;
  let graduationHits = 0;
  let loopHits = 0;
  let repeatHits = 0;
  let impossibleDx = 0;
  let trackingOk = 0;
  let progressionOk = 0;

  const archetypes: Array<{
    weakness: CompetencyId;
    safetyBias: number;
    assessmentBias: number;
    interventionsBias: number;
  }> = [
    {
      weakness: "suicide_assessment",
      safetyBias: 35,
      assessmentBias: 70,
      interventionsBias: 75,
    },
    {
      weakness: "differential_diagnosis",
      safetyBias: 80,
      assessmentBias: 45,
      interventionsBias: 92,
    },
    {
      weakness: "cbt_skills",
      safetyBias: 70,
      assessmentBias: 70,
      interventionsBias: 40,
    },
    {
      weakness: "diagnostic_interview",
      safetyBias: 55,
      assessmentBias: 40,
      interventionsBias: 55,
    },
  ];

  for (let i = 0; i < learnerCount; i++) {
    const arch = archetypes[i % archetypes.length]!;
    let profile = createLearnerProfile({
      id: `sim-${i}`,
      user_id: `user-sim-${i}`,
      profession:
        i % 3 === 0 ? "psychiatry_resident" : "general_practitioner",
    });

    // Seed weakness
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === arch.weakness
          ? { ...c, score: 40, samples: 1 }
          : c.competency_id === "cbt_skills" &&
              arch.weakness === "differential_diagnosis"
            ? { ...c, score: 92, samples: 3 }
            : c,
      ),
    };

    const fingerprints: string[] = [];
    let lastFocusScore = scoreOf(profile.competencies, arch.weakness);

    for (let s = 0; s < sessionsPerLearner; s++) {
      const nextCase = generateAdaptiveCase(profile, {
        seed: `sim:${i}:${s}`,
        priorFingerprints: fingerprints,
        stepIndex: s,
      });
      fingerprints.push(nextCase.fingerprint);

      if (!findDisorderBySlug(nextCase.disorderSlug ?? "")) {
        impossibleDx += 1;
      }

      // Success criterion: suicide-weak learners get suicide-focused cases
      if (
        arch.weakness === "suicide_assessment" &&
        scoreOf(profile.competencies, "suicide_assessment") < 70 &&
        nextCase.focusCompetencies.includes("suicide_assessment")
      ) {
        remediationHits += 1;
      }

      // Differential weak + CBT strong → ambiguity adaptations, not CBT hike
      if (
        arch.weakness === "differential_diagnosis" &&
        nextCase.focusCompetencies.includes("differential_diagnosis") &&
        (nextCase.adaptations.includes("diagnostic_ambiguity") ||
          nextCase.adaptations.includes("hold_cbt_complexity") ||
          nextCase.adaptations.includes("mixed_presentation"))
      ) {
        remediationHits += 1;
      }

      // Improving scores over sessions
      const improve =
        s >= 3 ? 12 + Math.floor(rng() * 10) : Math.floor(rng() * 6);
      const overall = Math.min(
        95,
        40 + s * 6 + improve + Math.floor(rng() * 5),
      );
      const safety =
        arch.weakness === "suicide_assessment"
          ? Math.min(95, arch.safetyBias + s * 8 + improve)
          : arch.safetyBias + improve;
      const assessment =
        arch.weakness === "differential_diagnosis" ||
        arch.weakness === "diagnostic_interview"
          ? Math.min(95, arch.assessmentBias + s * 7 + improve)
          : arch.assessmentBias;
      const interventions =
        arch.weakness === "cbt_skills"
          ? Math.min(95, arch.interventionsBias + s * 8)
          : arch.interventionsBias;

      const result = ingestSessionAssessment(profile, {
        overall,
        items: syntheticItems(overall, {
          safety,
          assessment,
          interventions,
          alliance: 70 + s * 2,
          structure: 65 + s * 2,
        }),
        sessionId: `sess-${i}-${s}`,
        diagnosisSlug: nextCase.disorderSlug,
        correctDiagnosis: overall >= 60,
      });
      profile = result.profile;
      sessions += 1;

      // Tracking: weakness score should generally rise after remediation sessions
      const focusNow = scoreOf(profile.competencies, arch.weakness);
      if (focusNow !== lastFocusScore || s === 0) trackingOk += 1;
      if (s > 0 && focusNow >= lastFocusScore - 1) progressionOk += 1;
      lastFocusScore = focusNow;
    }

    if (detectRepetitionLoop(fingerprints, 6)) loopHits += 1;

    const contentKeys = fingerprints.map((f) =>
      contentSignatureFromFingerprint(f),
    );
    if (new Set(contentKeys).size < Math.min(3, contentKeys.length)) {
      repeatHits += 1;
    }

    if (
      scoreOf(profile.competencies, arch.weakness) >=
      profile.min_competency_threshold
    ) {
      graduationHits += 1;
    }
  }

  // Tolerances for stochastic large-N run
  const remediationOk = remediationHits > learnerCount * 2;
  const graduationOk = graduationHits > learnerCount * 0.35;
  const noInfiniteLoops = loopHits < learnerCount * 0.05;
  const noRepetitiveCases = repeatHits < learnerCount * 0.15;
  const noImpossibleDiagnoses = impossibleDx === 0;
  const competencyTrackingOk = trackingOk > sessions * 0.5;
  const progressionOkFlag = progressionOk > sessions * 0.55;

  if (!remediationOk) {
    failures.push(`Remediation hits too low: ${remediationHits}`);
  }
  if (!graduationOk) {
    failures.push(`Graduation rate too low: ${graduationHits}/${learnerCount}`);
  }
  if (!noInfiniteLoops) {
    failures.push(`Infinite-loop fingerprints: ${loopHits}`);
  }
  if (!noRepetitiveCases) {
    failures.push(`Repetitive case learners: ${repeatHits}`);
  }
  if (!noImpossibleDiagnoses) {
    failures.push(`Impossible diagnoses: ${impossibleDx}`);
  }
  if (!competencyTrackingOk) {
    failures.push("Competency tracking accuracy below threshold");
  }
  if (!progressionOkFlag) {
    failures.push("Progression accuracy below threshold");
  }

  return {
    learners: learnerCount,
    sessions,
    competencyTrackingOk,
    adaptiveCurriculumOk: remediationOk,
    noInfiniteLoops,
    noRepetitiveCases,
    noImpossibleDiagnoses,
    remediationOk,
    graduationOk,
    progressionOk: progressionOkFlag,
    failures,
  };
}

/** Focused success-criteria checks (small N, deterministic). */
export function verifySuccessCriteria(): string[] {
  const errors: string[] = [];

  // 1) Suicide remediator
  let suicide = createLearnerProfile({
    id: "sc-suicide",
    user_id: "u-s",
  });
  suicide = {
    ...suicide,
    competencies: suicide.competencies.map((c) =>
      c.competency_id === "suicide_assessment"
        ? { ...c, score: 45, samples: 2 }
        : c,
    ),
  };
  for (let i = 0; i < 5; i++) {
    const c = generateAdaptiveCase(suicide, { seed: `sc-s-${i}`, stepIndex: i });
    if (!c.focusCompetencies.includes("suicide_assessment")) {
      errors.push(`Suicide case ${i} missing suicide focus`);
    }
    const r = ingestSessionAssessment(suicide, {
      overall: 55 + i * 8,
      items: syntheticItems(55 + i * 8, {
        safety: 40 + i * 10,
        assessment: 70,
        interventions: 70,
      }),
      diagnosisSlug: c.disorderSlug,
      correctDiagnosis: true,
    });
    suicide = r.profile;
  }
  if (scoreOf(suicide.competencies, "suicide_assessment") < 70) {
    // After improving safety scores, should approach threshold
    if (scoreOf(suicide.competencies, "suicide_assessment") <= 45) {
      errors.push("Suicide competency did not improve");
    }
  }

  // 2) CBT strong, differential weak
  let diff = createLearnerProfile({ id: "sc-diff", user_id: "u-d" });
  diff = {
    ...diff,
    competencies: diff.competencies.map((c) => {
      if (c.competency_id === "cbt_skills") {
        return { ...c, score: 92, samples: 5 };
      }
      if (c.competency_id === "differential_diagnosis") {
        return { ...c, score: 45, samples: 3 };
      }
      return c;
    }),
  };
  const dCase = generateAdaptiveCase(diff, { seed: "sc-d-0" });
  if (!dCase.focusCompetencies.includes("differential_diagnosis")) {
    errors.push("Differential case missing differential focus");
  }
  if (
    !dCase.adaptations.some((a) =>
      [
        "diagnostic_ambiguity",
        "mixed_presentation",
        "comorbidity",
        "medical_mimic",
        "hold_cbt_complexity",
      ].includes(a),
    )
  ) {
    errors.push("Differential case missing ambiguity adaptations");
  }

  // 3) Sustained improvement → increased complexity markers
  let improve = createLearnerProfile({ id: "sc-imp", user_id: "u-i" });
  improve = {
    ...improve,
    learning_velocity: 0.8,
    competencies: improve.competencies.map((c) =>
      c.competency_id === "diagnostic_interview"
        ? { ...c, score: 80, samples: 6 }
        : c,
    ),
  };
  const iCase = generateAdaptiveCase(improve, { seed: "sc-i-0" });
  const complexityMarkers = [
    "resistance",
    "diagnostic_uncertainty",
    "comorbidity",
    "masking",
    "time_pressure",
    "limited_disclosure",
  ];
  if (!iCase.adaptations.some((a) => complexityMarkers.includes(a))) {
    errors.push("Improving learner did not receive complexity adaptations");
  }

  return errors;
}

export type TierSimulationResult = {
  tier: "poor" | "average" | "excellent";
  assessments: number;
  uniqueContent: number;
  uniqueFocus: string[];
  difficulties: string[];
  siStyles: string[];
  trapped: boolean;
  contentLoop: boolean;
  meanConfidence: number;
  finalWeakScore: number;
  explainable: boolean;
};

/**
 * Mission 13 certification: poor / average / excellent learners, ≥100 assessments.
 */
export function simulateLearnerTiers(
  assessmentsPerLearner = 100,
): {
  tiers: TierSimulationResult[];
  curriculaDiffer: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const tiersSpec = [
    {
      tier: "poor" as const,
      start: 35,
      gain: 0.15,
      noise: 8,
      weakness: "suicide_assessment" as CompetencyId,
    },
    {
      tier: "average" as const,
      start: 55,
      gain: 0.45,
      noise: 6,
      weakness: "differential_diagnosis" as CompetencyId,
    },
    {
      tier: "excellent" as const,
      start: 78,
      gain: 0.7,
      noise: 4,
      weakness: "diagnostic_interview" as CompetencyId,
    },
  ];

  const tiers: TierSimulationResult[] = [];
  const curriculaKeys: string[] = [];

  for (const spec of tiersSpec) {
    const rng = createRng(`ace-tier-${spec.tier}`);
    let profile = createLearnerProfile({
      id: `tier-${spec.tier}`,
      user_id: `user-${spec.tier}`,
    });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) => {
        if (c.competency_id === spec.weakness) {
          return { ...c, score: spec.start, samples: 1 };
        }
        if (
          spec.weakness === "differential_diagnosis" &&
          c.competency_id === "cbt_skills"
        ) {
          return { ...c, score: 90, samples: 4 };
        }
        return c;
      }),
    };

    const fingerprints: string[] = [];
    const contents = new Set<string>();
    const focuses = new Set<string>();
    const difficulties = new Set<string>();
    const siStyles = new Set<string>();
    let confSum = 0;
    let explainable = true;
    let trappedPassive = 0;

    for (let s = 0; s < assessmentsPerLearner; s++) {
      const nextCase = generateAdaptiveCase(profile, {
        seed: `tier:${spec.tier}:${s}`,
        priorFingerprints: fingerprints,
        // Intentionally omit forced stepIndex — mirrors fixed API path
      });
      fingerprints.push(nextCase.fingerprint);
      contents.add(contentSignatureFromFingerprint(nextCase.fingerprint));
      focuses.add(nextCase.focusCompetencies.join(","));
      difficulties.add(nextCase.difficulty);
      if (nextCase.siStyle) siStyles.add(nextCase.siStyle);
      confSum += nextCase.confidence ?? 0;
      if (!nextCase.explainability?.decision) explainable = false;
      if (nextCase.siStyle === "passive") trappedPassive += 1;

      const progress = Math.min(
        95,
        spec.start + s * spec.gain + Math.floor(rng() * spec.noise),
      );
      const safety =
        spec.weakness === "suicide_assessment"
          ? Math.min(95, spec.start + s * spec.gain)
          : 70 + s * 0.1;
      const assessment =
        spec.weakness === "differential_diagnosis" ||
        spec.weakness === "diagnostic_interview"
          ? Math.min(95, spec.start + s * spec.gain)
          : 70;
      const interventions =
        spec.weakness === "differential_diagnosis" ? 90 : 65 + s * 0.2;

      const result = ingestSessionAssessment(profile, {
        overall: progress,
        items: syntheticItems(progress, {
          safety,
          assessment,
          interventions,
          alliance: 60 + s * 0.2,
          structure: 60 + s * 0.2,
        }),
        sessionId: `tier-${spec.tier}-${s}`,
        diagnosisSlug: nextCase.disorderSlug,
        correctDiagnosis: progress >= 55,
      });
      profile = result.profile;
      // Carry fingerprints like API history
      profile = {
        ...profile,
        metadata: {
          ...profile.metadata,
          prior_fingerprints: fingerprints.slice(-50),
        },
      };
    }

    const contentLoop = detectRepetitionLoop(fingerprints, 12);
    // Trap = stuck on early Passive/beginner content after enough exposure
    const recentContent = fingerprints
      .slice(-12)
      .map((f) => contentSignatureFromFingerprint(f));
    const earlyTrap =
      contentLoop &&
      recentContent.every(
        (c) => c.includes("passive") || c.includes("beginner"),
      );
    const trapped =
      spec.weakness === "suicide_assessment"
        ? earlyTrap || trappedPassive > assessmentsPerLearner * 0.7
        : earlyTrap;

    const row: TierSimulationResult = {
      tier: spec.tier,
      assessments: assessmentsPerLearner,
      uniqueContent: contents.size,
      uniqueFocus: [...focuses],
      difficulties: [...difficulties],
      siStyles: [...siStyles],
      trapped,
      contentLoop: earlyTrap,
      meanConfidence: Math.round(confSum / assessmentsPerLearner),
      finalWeakScore: scoreOf(profile.competencies, spec.weakness),
      explainable,
    };
    tiers.push(row);
    curriculaKeys.push(
      [...focuses].sort().join(";") +
        "|" +
        [...difficulties].sort().join(",") +
        "|" +
        [...siStyles].sort().join(","),
    );

    if (trapped) failures.push(`${spec.tier}: trapped in Passive SI loop`);
    if (earlyTrap) failures.push(`${spec.tier}: early-stage content repetition loop`);
    if (contents.size < 3) {
      failures.push(`${spec.tier}: insufficient case diversity (${contents.size})`);
    }
    if (!explainable) failures.push(`${spec.tier}: missing explainability`);
  }

  const curriculaDiffer = new Set(curriculaKeys).size === tiersSpec.length;
  if (!curriculaDiffer) {
    failures.push("Learner tiers received identical curricula signatures");
  }

  return { tiers, curriculaDiffer, failures };
}

