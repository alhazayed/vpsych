/**
 * Bridge: Competency Graph Engine ↔ Adaptive Curriculum Engine.
 * Additive — does not remove flat ACE scoring.
 */

import type { AdaptiveCaseRequest, LearnerProfile } from "@/lib/ace/types";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import {
  analyzeRootCause,
  buildSupervisorReport,
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "./engine";
import type { SupervisorGraphReport } from "./types";

/**
 * Prefer graph root-cause focus when generating the next adaptive case.
 */
export function generateGraphAwareAdaptiveCase(
  profile: LearnerProfile,
  opts?: {
    seed?: string | number;
    priorFingerprints?: string[];
    observedFailure?: string;
  },
): AdaptiveCaseRequest & {
  rootCause?: string;
  remediationPathway?: string[];
} {
  const states = statesFromAceCompetencies(profile.competencies);
  const assessed = states.filter((s) => s.samples > 0);
  const observed =
    opts?.observedFailure ??
    [...assessed].sort((a, b) => a.score - b.score)[0]?.competency_id;

  let rootCause: string | undefined;
  let pathway: string[] | undefined;

  if (observed) {
    const rca = analyzeRootCause(observed, states);
    rootCause = rca.root_cause;
    const plan = generateLearningPathFromGraph(
      profile.id,
      states,
      observed,
    );
    pathway = plan.pathway.map((p) => p.title);

    // Temporarily bias required competencies toward root cause
    const biased: LearnerProfile = {
      ...profile,
      required_competencies: [
        rootCause as LearnerProfile["required_competencies"][number],
        ...(profile.required_competencies ?? []),
      ],
      competencies: profile.competencies.map((c) =>
        c.competency_id === rootCause ||
        c.competency_id === (observed as typeof c.competency_id)
          ? c
          : c,
      ),
    };

    // Ensure root cause appears weak so ACE rules/focus pick it
    const comps = biased.competencies.map((c) => {
      if (c.competency_id === rootCause) {
        return {
          ...c,
          score: Math.min(c.score, 55),
          samples: Math.max(c.samples, 1),
        };
      }
      return c;
    });
    // If root cause not in ACE flat list, keep ACE generation but annotate
    const hasRoot = comps.some((c) => c.competency_id === rootCause);
    const base = generateAdaptiveCase(
      { ...biased, competencies: comps },
      {
        seed: opts?.seed,
        priorFingerprints: opts?.priorFingerprints,
      },
    );

    if (!hasRoot) {
      return {
        ...base,
        focusCompetencies: [
          rootCause as (typeof base.focusCompetencies)[number],
          ...base.focusCompetencies,
        ],
        rationale: `CGE root cause ${rootCause}: ${base.rationale}`,
        adaptations: [
          ...base.adaptations,
          `cge_root:${rootCause}`,
          `cge_observed:${observed}`,
        ],
        rootCause,
        remediationPathway: pathway,
      };
    }

    return {
      ...base,
      focusCompetencies: base.focusCompetencies.includes(
        rootCause as (typeof base.focusCompetencies)[number],
      )
        ? base.focusCompetencies
        : [
            rootCause as (typeof base.focusCompetencies)[number],
            ...base.focusCompetencies,
          ],
      rationale: `CGE root cause ${rootCause} ← observed ${observed}. ${base.rationale}`,
      adaptations: [
        ...base.adaptations,
        `cge_root:${rootCause}`,
        `cge_observed:${observed}`,
      ],
      rootCause,
      remediationPathway: pathway,
    };
  }

  return generateAdaptiveCase(profile, {
    seed: opts?.seed,
    priorFingerprints: opts?.priorFingerprints,
  });
}

export function graphSupervisorForProfile(
  profile: LearnerProfile,
  observedFailure?: string,
): SupervisorGraphReport {
  const states = statesFromAceCompetencies(profile.competencies);
  return buildSupervisorReport(profile.id, states, observedFailure);
}
