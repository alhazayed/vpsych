/**
 * Bridge: Competency Graph Engine ↔ Adaptive Curriculum Engine.
 * Additive — does not remove flat ACE scoring.
 */

import type { AdaptiveCaseRequest, LearnerProfile } from "@/lib/ace/types";
import { generateAdaptiveCase, selectActiveRules } from "@/lib/ace/adaptive";
import {
  analyzeRootCause,
  buildSupervisorReport,
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "./engine";
import type { SupervisorGraphReport } from "./types";

/**
 * Prefer graph root-cause annotation when generating the next adaptive case.
 * Does NOT fabricate weakness scores (that previously hijacked ACE remediation).
 */
export function generateGraphAwareAdaptiveCase(
  profile: LearnerProfile,
  opts?: {
    seed?: string | number;
    priorFingerprints?: string[];
    observedFailure?: string;
    stepIndex?: number;
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

  const active = selectActiveRules(profile);
  const primary = active[0];

  // When a high-priority ACE remediation rule is active, keep ACE focus and
  // only annotate CGE root-cause (do not override suicide/differential paths).
  if (primary && primary.priority >= 80) {
    const base = generateAdaptiveCase(profile, {
      seed: opts?.seed,
      priorFingerprints: opts?.priorFingerprints,
      stepIndex: opts?.stepIndex,
    });
    if (!observed) {
      return base;
    }
    const rca = analyzeRootCause(observed, states);
    const plan = generateLearningPathFromGraph(profile.id, states, observed);
    return {
      ...base,
      adaptations: [
        ...base.adaptations,
        `cge_root:${rca.root_cause}`,
        `cge_observed:${observed}`,
        "cge_annotate_only",
      ],
      rationale: `${base.rationale} [CGE annotate: root ${rca.root_cause} ← ${observed}]`,
      explainability: {
        active_rules: base.explainability?.active_rules ?? [primary.slug],
        decision: `${base.explainability?.decision ?? base.rationale} CGE root-cause ${rca.root_cause} annotated without overriding ACE remediation focus.`,
        ladder_step: base.explainability?.ladder_step,
        content_signature: base.explainability?.content_signature,
      },
      rootCause: rca.root_cause,
      remediationPathway: plan.pathway.map((p) => p.title),
    };
  }

  if (observed) {
    const rca = analyzeRootCause(observed, states);
    const rootCause = rca.root_cause;
    const plan = generateLearningPathFromGraph(profile.id, states, observed);
    const pathway = plan.pathway.map((p) => p.title);

    // Bias required competencies toward root cause WITHOUT fabricating scores.
    const biased: LearnerProfile = {
      ...profile,
      required_competencies: [
        rootCause as LearnerProfile["required_competencies"][number],
        ...(profile.required_competencies ?? []),
      ],
    };

    const base = generateAdaptiveCase(biased, {
      seed: opts?.seed,
      priorFingerprints: opts?.priorFingerprints,
      stepIndex: opts?.stepIndex,
    });

    const focusCompetencies = base.focusCompetencies.includes(
      rootCause as (typeof base.focusCompetencies)[number],
    )
      ? base.focusCompetencies
      : [
          rootCause as (typeof base.focusCompetencies)[number],
          ...base.focusCompetencies,
        ];

    return {
      ...base,
      focusCompetencies,
      rationale: `CGE root cause ${rootCause} ← observed ${observed}. ${base.rationale}`,
      adaptations: [
        ...base.adaptations,
        `cge_root:${rootCause}`,
        `cge_observed:${observed}`,
      ],
      explainability: {
        active_rules: base.explainability?.active_rules ?? [],
        decision: `CGE RCA selected root ${rootCause} from observed ${observed} without score fabrication. ${base.explainability?.decision ?? ""}`,
        ladder_step: base.explainability?.ladder_step,
        content_signature: base.explainability?.content_signature,
      },
      rootCause,
      remediationPathway: pathway,
    };
  }

  return generateAdaptiveCase(profile, {
    seed: opts?.seed,
    priorFingerprints: opts?.priorFingerprints,
    stepIndex: opts?.stepIndex,
  });
}

export function graphSupervisorForProfile(
  profile: LearnerProfile,
  observedFailure?: string,
): SupervisorGraphReport {
  const states = statesFromAceCompetencies(profile.competencies);
  return buildSupervisorReport(profile.id, states, observedFailure);
}
