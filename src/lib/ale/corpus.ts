/**
 * Offline ALE corpus — weak / average / excellent longitudinal learners.
 */

import { createRng } from "@/lib/case-engine/generator";
import {
  createLearnerProfile,
  ingestSessionAssessment,
} from "@/lib/ace/engine";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import { generateGraphAwareAdaptiveCase } from "@/lib/cge/ace-bridge";
import {
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "@/lib/cge/engine";
import type { CompetencyId, LearnerProfile } from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";
import { computeAdaptiveLearningEffectiveness } from "@/lib/ale/engine";
import {
  aleInputFromTrajectory,
  type AleTrajectorySession,
} from "@/lib/ale/from-trajectory";
import type { StoredAleRecord } from "@/lib/ale/aggregate";
import {
  ACE_ENGINE_VERSION,
  CGE_ENGINE_VERSION,
} from "@/lib/scientific/versions";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function itemsFromOverall(overall: number, weak: CompetencyId): ScoreEntry[] {
  const to5 = (pct: number) =>
    Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
  const weakPenalty = 14;
  const mk = (id: string, pct: number): ScoreEntry => ({
    id,
    label: id,
    score: to5(pct),
    max: 5,
    weight: 20,
    feedback: `Focus practice on ${id} relative to session performance.`,
  });
  const safety =
    weak === "suicide_assessment" || weak === "risk_assessment"
      ? overall - weakPenalty
      : overall;
  const assessment =
    weak === "diagnostic_interview" ? overall - weakPenalty : overall;
  const interventions =
    weak === "cbt_skills" ? overall - weakPenalty : overall;
  return [
    mk("alliance", overall),
    mk("assessment", assessment),
    mk("interventions", interventions),
    mk("safety", safety),
    mk("structure", overall - 2),
  ];
}

type Archetype = {
  id: "weak" | "average" | "excellent";
  startOverall: number;
  learningRate: number;
  noise: number;
  weak: CompetencyId;
  objective: string;
  sessions: number;
};

const ARCHETYPES: Archetype[] = [
  {
    id: "weak",
    startOverall: 42,
    learningRate: 3.8,
    noise: 6,
    weak: "suicide_assessment",
    objective: "suicide_assessment",
    sessions: 10,
  },
  {
    id: "average",
    startOverall: 58,
    learningRate: 3.2,
    noise: 5,
    weak: "diagnostic_interview",
    objective: "diagnostic_interview",
    sessions: 10,
  },
  {
    id: "excellent",
    startOverall: 76,
    learningRate: 1.6,
    noise: 3,
    weak: "cbt_skills",
    objective: "cbt_skills",
    sessions: 10,
  },
];

/**
 * Simulate weak / average / excellent learners under ACE+CGE adaptive curriculum.
 */
export function buildAleOfflineCorpus(): StoredAleRecord[] {
  const records: StoredAleRecord[] = [];

  for (const arch of ARCHETYPES) {
    const rng = createRng(`ale-corpus-${arch.id}-v1`);
    let profile: LearnerProfile = createLearnerProfile({
      user_id: `ale-${arch.id}`,
      profession:
        arch.id === "excellent" ? "psychiatry_resident" : "medical_student",
      training_level:
        arch.id === "excellent"
          ? "residency"
          : arch.id === "average"
            ? "undergraduate"
            : "undergraduate",
    });
    profile = {
      ...profile,
      adaptive_mode: true,
      required_competencies: [arch.weak, "diagnostic_interview", "empathy"],
      competencies: profile.competencies.map((c) =>
        c.competency_id === arch.weak
          ? { ...c, score: Math.max(15, arch.startOverall - 18), samples: 1 }
          : c,
      ),
    };

    const traj: AleTrajectorySession[] = [];
    const priorFingerprints: string[] = [];
    let pathwaySteps = 0;

    for (let s = 0; s < arch.sessions; s++) {
      const weakest = [...profile.competencies]
        .filter((c) => c.samples > 0)
        .sort((a, b) => a.score - b.score)[0];

      const useGraph = s % 2 === 0;
      const next = useGraph
        ? generateGraphAwareAdaptiveCase(profile, {
            seed: `ale-${arch.id}-${s}`,
            priorFingerprints,
            observedFailure: weakest?.competency_id,
          })
        : generateAdaptiveCase(profile, {
            seed: `ale-${arch.id}-${s}`,
            priorFingerprints,
            stepIndex: s,
          });

      priorFingerprints.push(next.fingerprint);
      if (useGraph) {
        const states = statesFromAceCompetencies(profile.competencies);
        const path = generateLearningPathFromGraph(
          profile.id,
          states,
          weakest?.competency_id ?? arch.weak,
        );
        pathwaySteps = Math.max(pathwaySteps, path.pathway.length);
      }

      const progress = arch.startOverall + s * arch.learningRate;
      const noise = (rng() - 0.5) * 2 * arch.noise;
      // Adaptive boost when focus hits weakness
      const focusHit = next.focusCompetencies.includes(
        (weakest?.competency_id ?? arch.weak) as CompetencyId,
      );
      const boost = focusHit ? 2.5 : 0;
      const overall = clamp(progress + noise + boost);

      const missCount =
        overall < 55 ? 2 : overall < 70 ? 1 : s < 3 && arch.id === "weak" ? 1 : 0;

      const items = itemsFromOverall(overall, arch.weak);
      const ingested = ingestSessionAssessment(profile, {
        overall,
        items,
        sessionId: `ale-${arch.id}-${s}`,
        diagnosisSlug: next.disorderSlug ?? "mdd-recurrent-moderate",
        durationSec: 1200,
        timeLimitSec: 2400,
      });
      profile = ingested.profile;

      traj.push({
        overall,
        difficulty: next.difficulty,
        disorder_slug: next.disorderSlug ?? "mdd-recurrent-moderate",
        fingerprint: next.fingerprint,
        focus_competencies: next.focusCompetencies,
        weakest_competency: weakest?.competency_id ?? arch.weak,
        miss_flag_count: missCount,
        objective_id: arch.objective,
        focus_matches_objective: next.focusCompetencies.includes(
          arch.objective as CompetencyId,
        ),
        used_graph: useGraph,
        remediation: focusHit || (next.adaptations?.length ?? 0) > 0,
      });
    }

    const ale = computeAdaptiveLearningEffectiveness(
      aleInputFromTrajectory({
        learner_archetype: arch.id,
        sessions: traj,
        pathway_steps: Math.max(pathwaySteps, 3),
        adaptive_version: ACE_ENGINE_VERSION,
        curriculum_version: ACE_ENGINE_VERSION,
        competency_graph_version: CGE_ENGINE_VERSION,
      }),
    );

    records.push({
      overall: ale.overall,
      learner_archetype: arch.id,
      computed_at: new Date().toISOString(),
      ale,
    });
  }

  return records;
}
