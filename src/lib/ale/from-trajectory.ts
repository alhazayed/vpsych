/**
 * Build ALE input from a longitudinal adaptive trajectory.
 */

import type { AleComputeInput } from "@/lib/ale/types";
import {
  ACE_ENGINE_VERSION,
  CGE_ENGINE_VERSION,
} from "@/lib/scientific/versions";

export type AleTrajectorySession = {
  overall: number;
  difficulty: string;
  disorder_slug?: string | null;
  fingerprint?: string | null;
  focus_competencies?: string[];
  weakest_competency?: string | null;
  miss_flag_count?: number;
  objective_id?: string | null;
  focus_matches_objective?: boolean;
  used_graph?: boolean;
  remediation?: boolean;
};

export function aleInputFromTrajectory(opts: {
  learner_archetype: string;
  sessions: AleTrajectorySession[];
  pathway_steps?: number;
  adaptive_version?: string | null;
  curriculum_version?: string | null;
  competency_graph_version?: string | null;
}): AleComputeInput {
  const sessions = opts.sessions;
  let focusHits = 0;
  let focusAttempts = 0;
  let objHits = 0;
  let objAttempts = 0;
  let graphSessions = 0;
  let remediation = 0;
  const disorders = new Set<string>();
  const difficulties = new Set<string>();
  const fingerprints = new Set<string>();

  for (const s of sessions) {
    if (s.disorder_slug) disorders.add(s.disorder_slug);
    if (s.difficulty) difficulties.add(s.difficulty);
    if (s.fingerprint) fingerprints.add(s.fingerprint);
    if (s.used_graph) graphSessions += 1;
    if (s.remediation) remediation += 1;
    if (s.focus_competencies?.length) {
      focusAttempts += 1;
      if (
        s.weakest_competency &&
        s.focus_competencies.includes(s.weakest_competency)
      ) {
        focusHits += 1;
      }
    }
    if (s.objective_id) {
      objAttempts += 1;
      if (s.focus_matches_objective) objHits += 1;
    }
  }

  return {
    learner_archetype: opts.learner_archetype,
    session_overalls: sessions.map((s) => s.overall),
    difficulty_sequence: sessions.map((s) => s.difficulty),
    focus_hits_on_weakest: focusHits,
    focus_attempts: focusAttempts,
    unique_disorders: disorders.size,
    unique_difficulties: difficulties.size,
    unique_fingerprints: fingerprints.size,
    total_cases: sessions.length,
    remediation_sessions: remediation,
    miss_flag_counts: sessions.map((s) => s.miss_flag_count ?? 0),
    objective_alignment_hits: objHits,
    objective_alignment_attempts: objAttempts,
    graph_utilized_sessions: graphSessions,
    pathway_steps: opts.pathway_steps ?? 0,
    adaptive_decisions: focusAttempts,
    adaptive_version: opts.adaptive_version ?? ACE_ENGINE_VERSION,
    curriculum_version: opts.curriculum_version ?? ACE_ENGINE_VERSION,
    competency_graph_version:
      opts.competency_graph_version ?? CGE_ENGINE_VERSION,
  };
}
