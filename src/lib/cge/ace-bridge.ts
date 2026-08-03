/**
 * Bridge: Competency Graph Engine ↔ Adaptive Curriculum Engine.
 * Additive — does not remove flat ACE scoring.
 *
 * Educational integrity: never fabricate weakness scores. Prefer
 * focusCompetencies / required_competencies from root-cause analysis
 * without mutating the learner's assessed EMA evidence.
 */

import type { AdaptiveCaseRequest, CompetencyId, LearnerProfile } from "@/lib/ace/types";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import {
  analyzeRootCause,
  buildSupervisorReport,
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "./engine";
import { blockedCompetencies } from "./rca";
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

    // Prioritize root cause in required competencies WITHOUT inventing scores.
    const rootAsComp = rootCause as CompetencyId;
    const biased: LearnerProfile = {
      ...profile,
      required_competencies: [
        rootAsComp,
        ...(profile.required_competencies ?? []).filter((c) => c !== rootAsComp),
      ],
    };

    const base = generateAdaptiveCase(biased, {
      seed: opts?.seed,
      priorFingerprints: opts?.priorFingerprints,
      preferredFocus: filterEducationalFocus(
        [
          rootAsComp,
          ...plan.pathway.map((p) => p.competency_id as CompetencyId),
        ],
        biased,
      ),
    });

    const focus = uniqueFocus([
      rootAsComp,
      ...base.focusCompetencies,
    ]);

    return {
      ...base,
      focusCompetencies: focus,
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

function uniqueFocus(ids: CompetencyId[]): CompetencyId[] {
  const seen = new Set<string>();
  const out: CompetencyId[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Drop never-attempted CGE-blocked competencies from educational focus lists. */
export function filterEducationalFocus(
  focus: CompetencyId[],
  profile: LearnerProfile,
): CompetencyId[] {
  const states = statesFromAceCompetencies(profile.competencies);
  const blocked = new Set(blockedCompetencies(states));
  const byId = new Map(
    profile.competencies.map((c) => [c.competency_id, c] as const),
  );
  const filtered = focus.filter((f) => {
    if (!blocked.has(f)) return true;
    return (byId.get(f)?.samples ?? 0) > 0;
  });
  return filtered.length ? filtered : focus.slice(0, 1);
}

export function graphSupervisorForProfile(
  profile: LearnerProfile,
  observedFailure?: string,
): SupervisorGraphReport {
  const states = statesFromAceCompetencies(profile.competencies);
  return buildSupervisorReport(profile.id, states, observedFailure);
}
