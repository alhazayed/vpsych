/**
 * Patient-felt session rating (SRS-style) — how the session felt to the
 * patient, read from the patient's own adaptation state (rapport, trust,
 * disclosure readiness), which the Patient Adaptation Engine updates every
 * turn. This adds no second clinical brain: it only reads the trace the
 * existing engine already persists in `case_memory.memory.patient_adaptation`.
 *
 * Four dimensions on 0–10, modelled on the Session Rating Scale's structure
 * (relationship, goals and topics, approach, overall). It is a simulation
 * read-out, not the SRS, and not validated.
 */

import type {
  AdaptationTurnTrace,
  PatientAdaptationState,
  TherapistBehaviourCue,
} from "@/lib/adaptation/types";

export const ALLIANCE_RATING_VERSION = "alliance-rating.v1" as const;

/** A trust drop at least this large in one turn counts as a rupture. */
export const RUPTURE_TRUST_DROP = 5;
/** Each rupture left unrepaired at session end costs this much "overall". */
export const UNREPAIRED_RUPTURE_PENALTY = 0.5;

const RUPTURE_CUES: readonly TherapistBehaviourCue[] = [
  "judgment",
  "confrontation",
  "curt",
  "interruption",
];

export type AllianceRupture = {
  /** 0-based index among this session's turns. */
  turn_index: number;
  trust_before: number;
  trust_after: number;
  cues: TherapistBehaviourCue[];
  repaired: boolean;
  /** Turn index where trust recovered to its pre-rupture level, if it did. */
  repaired_turn_index: number | null;
};

export type AllianceRating = {
  version: typeof ALLIANCE_RATING_VERSION;
  /** 0–10 each, one decimal. */
  relationship: number;
  goals_topics: number;
  approach: number;
  overall: number;
  /** Sum of the four, 0–40. */
  total: number;
  turns: number;
  ruptures: AllianceRupture[];
  limitations: string[];
};

export const ALLIANCE_RATING_LIMITATIONS = [
  "Simulated: read from the virtual patient's internal rapport and trust, not reported by a real client.",
  "Modelled on the Session Rating Scale's four areas but it is not the SRS and is not validated.",
  "Ruptures are trust drops of 5 or more points in one turn; repair means trust returned to its earlier level within the session.",
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const toTen = (n: number) => round1(Math.min(10, Math.max(0, n / 10)));

/** Traces recorded between the session's start and end (inclusive). */
export function sessionTraces(
  state: Pick<PatientAdaptationState, "turn_traces"> | null | undefined,
  startedAt: string,
  endedAt: string | null,
): AdaptationTurnTrace[] {
  if (!state?.turn_traces?.length) return [];
  const from = Date.parse(startedAt);
  const to = endedAt ? Date.parse(endedAt) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(from)) return [];
  return state.turn_traces.filter((t) => {
    const at = Date.parse(t.at);
    return Number.isFinite(at) && at >= from && at <= to;
  });
}

export function findRuptures(traces: AdaptationTurnTrace[]): AllianceRupture[] {
  const ruptures: AllianceRupture[] = [];
  for (let i = 1; i < traces.length; i++) {
    const before = traces[i - 1]!.trust;
    const after = traces[i]!.trust;
    const cues = traces[i]!.cues ?? [];
    const drop = before - after;
    if (drop < RUPTURE_TRUST_DROP) continue;
    if (!cues.some((c) => RUPTURE_CUES.includes(c)) && drop < RUPTURE_TRUST_DROP * 2) {
      continue;
    }
    let repairedAt: number | null = null;
    for (let j = i + 1; j < traces.length; j++) {
      if (traces[j]!.trust >= before) {
        repairedAt = j;
        break;
      }
    }
    ruptures.push({
      turn_index: i,
      trust_before: before,
      trust_after: after,
      cues: cues.filter((c) => RUPTURE_CUES.includes(c)),
      repaired: repairedAt != null,
      repaired_turn_index: repairedAt,
    });
  }
  return ruptures;
}

/**
 * Rating for one session, or null when the patient engine left no trace for
 * it (no case instance, or the session predates the engine).
 */
export function buildAllianceRating(input: {
  state: Pick<PatientAdaptationState, "turn_traces"> | null | undefined;
  startedAt: string;
  endedAt: string | null;
}): AllianceRating | null {
  const traces = sessionTraces(input.state, input.startedAt, input.endedAt);
  if (traces.length === 0) return null;

  const last = traces[traces.length - 1]!;
  const meanDisclosure =
    traces.reduce((sum, t) => sum + t.disclosure_readiness, 0) / traces.length;

  const relationship = toTen(last.rapport);
  const goals_topics = toTen(meanDisclosure);
  const approach = toTen(last.trust);
  const ruptures = findRuptures(traces);
  const unrepaired = ruptures.filter((r) => !r.repaired).length;
  const overall = round1(
    Math.min(
      10,
      Math.max(
        0,
        (relationship + goals_topics + approach) / 3 - unrepaired * UNREPAIRED_RUPTURE_PENALTY,
      ),
    ),
  );

  return {
    version: ALLIANCE_RATING_VERSION,
    relationship,
    goals_topics,
    approach,
    overall,
    total: round1(relationship + goals_topics + approach + overall),
    turns: traces.length,
    ruptures,
    limitations: ALLIANCE_RATING_LIMITATIONS,
  };
}
