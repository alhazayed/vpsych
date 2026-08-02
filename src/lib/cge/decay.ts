import type { GraphCompetencyId, LearnerNodeState } from "./types";

const DECAY_DAYS = 60;
const DECAY_RATE_PER_30_DAYS = 8; // confidence points

export function daysSince(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now - t) / (1000 * 60 * 60 * 24));
}

/**
 * Apply knowledge decay to confidence (mastery history preserved via stage).
 */
export function applyCompetencyDecay(
  states: LearnerNodeState[],
  now = Date.now(),
): {
  states: LearnerNodeState[];
  atRisk: GraphCompetencyId[];
  events: Array<{
    competency_id: string;
    previous_confidence: number;
    new_confidence: number;
    days_idle: number;
  }>;
} {
  const atRisk: string[] = [];
  const events: Array<{
    competency_id: string;
    previous_confidence: number;
    new_confidence: number;
    days_idle: number;
  }> = [];

  const next = states.map((s) => {
    const idle = daysSince(s.last_practiced_at, now);
    if (s.samples === 0 || idle < DECAY_DAYS) {
      if (s.samples > 0 && idle >= DECAY_DAYS - 14) atRisk.push(s.competency_id);
      return s;
    }
    const periods = Math.floor(idle / 30);
    const prev = s.confidence;
    const neu = Math.max(20, prev - periods * DECAY_RATE_PER_30_DAYS);
    if (neu < prev) {
      events.push({
        competency_id: s.competency_id,
        previous_confidence: prev,
        new_confidence: neu,
        days_idle: idle,
      });
      atRisk.push(s.competency_id);
      return { ...s, confidence: neu };
    }
    return s;
  });

  return { states: next, atRisk: [...new Set(atRisk)], events };
}
