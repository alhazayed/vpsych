/**
 * Turn numbers that match the examiner's citations.
 *
 * The examiner numbers every stored message of a session in `created_at`
 * order, the opening system line included (`assessSession` in
 * lib/ai/assessment.ts). Transcripts on screen hide that system line, so
 * counting visible lines would put "Turn 7" in a report one line away from
 * what was said in turn 7. Number the full list, then hide system lines.
 */

export type TurnRole = "user" | "assistant" | "system" | string;

export type NumberedTurn<T> = T & { turn: number };

/** Spoken lines (therapist and patient) with the examiner's turn number. */
export function numberTranscriptTurns<T extends { role: TurnRole }>(
  messages: readonly T[],
): NumberedTurn<T>[] {
  const out: NumberedTurn<T>[] = [];
  messages.forEach((m, i) => {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ ...m, turn: i + 1 });
    }
  });
  return out;
}

/**
 * Element id for one turn. `scope` keeps ids unique when a page shows more
 * than one session (a skill test lists every session of the test).
 */
export function turnAnchorId(turn: number, scope?: string): string {
  const prefix = scope ? `${scope.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12)}-` : "";
  return `${prefix}turn-${turn}`;
}
