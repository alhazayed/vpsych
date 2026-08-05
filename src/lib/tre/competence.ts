/**
 * Derive therapist competence 0–100 from session signals (educational proxy).
 */

export type CompetenceSignals = {
  alliance_mean: number;
  empathy_cues?: number;
  warmth_cues?: number;
  confrontation_cues?: number;
  repair_cues?: number;
  skill_cues?: number; // cbt/mi/dbt-like
  rupture_count?: number;
  turn_count?: number;
};

export function estimateTherapistCompetence(s: CompetenceSignals): number {
  let score = s.alliance_mean * 0.45;
  score += Math.min(25, (s.empathy_cues ?? 0) * 2.5);
  score += Math.min(15, (s.warmth_cues ?? 0) * 2);
  score += Math.min(20, (s.skill_cues ?? 0) * 3);
  score += Math.min(10, (s.repair_cues ?? 0) * 4);
  score -= Math.min(25, (s.confrontation_cues ?? 0) * 3);
  score -= Math.min(20, (s.rupture_count ?? 0) * 6);
  if ((s.turn_count ?? 0) < 3) score -= 8;
  return Math.max(5, Math.min(95, Math.round(score * 10) / 10));
}

/** Aggregate cue counts from PME turn_traces therapist_cues. */
export function competenceFromTurnCues(
  cues: string[][],
  allianceMean: number,
  ruptureCount: number,
): number {
  let empathy = 0;
  let warmth = 0;
  let confrontation = 0;
  let repair = 0;
  let skill = 0;
  for (const list of cues) {
    for (const c of list) {
      if (c === "empathy" || c === "validation") empathy += 1;
      if (c === "warmth") warmth += 1;
      if (c === "confrontation" || c === "stacked_questions" || c === "curt")
        confrontation += 1;
      if (c === "repair") repair += 1;
      if (c === "cbt_skill" || c === "mi_skill") skill += 1;
    }
  }
  return estimateTherapistCompetence({
    alliance_mean: allianceMean,
    empathy_cues: empathy,
    warmth_cues: warmth,
    confrontation_cues: confrontation,
    repair_cues: repair,
    skill_cues: skill,
    rupture_count: ruptureCount,
    turn_count: cues.length,
  });
}
