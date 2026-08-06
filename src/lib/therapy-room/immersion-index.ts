import type {
  ImmersionEvent,
  ImmersionEventKind,
  TherapyRoomImmersionIndex,
} from "./types";

function countKinds(events: ImmersionEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  }
  return counts;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Therapy Room Immersion Index (TRII).
 *
 * Sub-scores are 0–100 where higher is better immersion
 * (for interruptionFrequency and transcriptDependency, higher means
 * *less* distraction — i.e. fewer interrupts / less transcript reliance).
 */
export function computeImmersionIndex(
  events: ImmersionEvent[],
  opts?: { sessionDurationMs?: number },
): TherapyRoomImmersionIndex {
  const counts = countKinds(events);
  const handsFree = counts.hands_free_turn ?? 0;
  const manual = counts.manual_mic_turn ?? 0;
  const text = counts.text_turn ?? 0;
  const turns = handsFree + manual + text;
  const therapistInterrupts = counts.therapist_interrupt ?? 0;
  const patientInterrupts = counts.patient_interrupt ?? 0;
  const pauses = counts.pause ?? 0;
  const controlOpens =
    (counts.control_open ?? 0) +
    (counts.settings_open ?? 0) +
    (counts.notes_open ?? 0);
  const transcriptOpens = counts.transcript_opened ?? 0;
  const transcriptCloses = counts.transcript_closed ?? 0;

  const handsFreeUsage =
    turns === 0 ? 50 : clamp((handsFree / turns) * 100);

  const interfaceDistraction = clamp(
    100 - controlOpens * 8 - pauses * 5 - text * 12,
  );

  const conversationContinuity = clamp(
    100 -
      pauses * 10 -
      (turns > 0 ? (text / turns) * 40 : 0) -
      (manual > 0 ? (manual / Math.max(turns, 1)) * 25 : 0),
  );

  const interruptionFrequency = clamp(
    100 - therapistInterrupts * 6 - patientInterrupts * 4,
  );

  const transcriptDependency = clamp(
    100 - transcriptOpens * 15 + transcriptCloses * 5,
  );

  const durationMin = (opts?.sessionDurationMs ?? 0) / 60000;
  const continuityBonus =
    durationMin >= 5 && pauses <= 1 && handsFreeUsage >= 70 ? 10 : 0;

  const userImmersion = clamp(
    (interfaceDistraction +
      conversationContinuity +
      handsFreeUsage +
      interruptionFrequency +
      transcriptDependency) /
      5 +
      continuityBonus,
  );

  const overall = clamp(
    interfaceDistraction * 0.2 +
      conversationContinuity * 0.25 +
      handsFreeUsage * 0.25 +
      interruptionFrequency * 0.1 +
      transcriptDependency * 0.1 +
      userImmersion * 0.1,
  );

  return {
    overall,
    interfaceDistraction,
    conversationContinuity,
    handsFreeUsage,
    interruptionFrequency,
    transcriptDependency,
    userImmersion,
    eventCounts: counts,
  };
}

export function createImmersionTracker() {
  const events: ImmersionEvent[] = [];
  const startedAt = Date.now();

  return {
    track(kind: ImmersionEventKind) {
      events.push({ kind, at: Date.now() });
    },
    events: () => events.slice(),
    finalize(): TherapyRoomImmersionIndex {
      return computeImmersionIndex(events, {
        sessionDurationMs: Date.now() - startedAt,
      });
    },
  };
}

export type ImmersionTracker = ReturnType<typeof createImmersionTracker>;
