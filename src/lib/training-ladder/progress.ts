/**
 * Ladder progress, derived from the trainee's graded attempts. Pure: the
 * database decides what is passed (trigger on session_reports) and refuses an
 * attempt above the unlocked level; this module only reads the result.
 */
import {
  LADDER_LEVEL_COUNT,
  LADDER_LEVELS,
  isLadderLevel,
  type LadderLevel,
} from "@/lib/training-ladder/levels";

export type LadderAttemptStatus =
  | "in_progress"
  | "awaiting_score"
  | "passed"
  | "failed";

export type LadderAttemptRow = {
  id: string;
  session_id: string;
  patient_key: string;
  level: number;
  status: LadderAttemptStatus;
  score: number | null;
  created_at: string;
  /** Embedded `sessions(status)` when loaded with the attempt. */
  session_status?: string | null;
};

export type LadderLevelState = "cleared" | "current" | "locked";

export type LadderProgress = {
  levels: Array<{ level: LadderLevel; state: LadderLevelState }>;
  /** Highest level the trainee may start (the next one to clear). */
  currentLevel: LadderLevel;
  clearedCount: number;
  completed: boolean;
};

export function ladderProgress(
  attempts: readonly Pick<LadderAttemptRow, "level" | "status">[],
): LadderProgress {
  const passed = new Set(
    attempts
      .filter((a) => a.status === "passed" && isLadderLevel(a.level))
      .map((a) => a.level as LadderLevel),
  );
  // Levels unlock in order; count the unbroken run of cleared levels.
  let cleared = 0;
  while (cleared < LADDER_LEVEL_COUNT && passed.has((cleared + 1) as LadderLevel)) {
    cleared += 1;
  }
  const completed = cleared === LADDER_LEVEL_COUNT;
  const currentLevel = Math.min(cleared + 1, LADDER_LEVEL_COUNT) as LadderLevel;
  return {
    levels: LADDER_LEVELS.map(({ level }) => ({
      level,
      state:
        level <= cleared ? "cleared" : level === cleared + 1 ? "current" : "locked",
    })),
    currentLevel,
    clearedCount: cleared,
    completed,
  };
}

/** A trainee may play the current level or replay any cleared one. */
export function canStartLadderLevel(
  progress: LadderProgress,
  level: LadderLevel,
): boolean {
  return level <= progress.currentLevel;
}

export type AttemptOutcome =
  | "passed"
  | "failed"
  | "scoring"
  | "in_session"
  | "no_report";

/**
 * What to show for one attempt. "scoring" covers a report produced by the
 * fallback examiner: it does not count until an admin regenerates it.
 */
export function attemptOutcome(
  attempt: Pick<LadderAttemptRow, "status" | "session_status">,
): AttemptOutcome {
  if (attempt.status === "passed") return "passed";
  if (attempt.status === "failed") return "failed";
  if (attempt.status === "awaiting_score") return "scoring";
  return attempt.session_status === "active" ? "in_session" : "no_report";
}

/** Attempts numbered per level, oldest first ("Easy 1, Easy 2, Basic 1"). */
export function numberAttempts<T extends Pick<LadderAttemptRow, "level" | "created_at">>(
  attempts: readonly T[],
): Array<T & { attemptNumber: number }> {
  const sorted = [...attempts].sort(
    (a, b) =>
      a.level - b.level ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const counts = new Map<number, number>();
  return sorted.map((a) => {
    const n = (counts.get(a.level) ?? 0) + 1;
    counts.set(a.level, n);
    return { ...a, attemptNumber: n };
  });
}
