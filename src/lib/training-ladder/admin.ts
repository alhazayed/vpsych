/**
 * Admin view of every trainee's ladder. Admins can read every attempt
 * (RLS: owner or admin); progress is derived exactly as on the trainee's own
 * pages, so both views always agree. Read-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LADDER_ATTEMPT_COLUMNS,
  normalizeLadderAttempt,
} from "@/lib/training-ladder/persist";
import {
  ladderProgress,
  type LadderAttemptRow,
  type LadderProgress,
} from "@/lib/training-ladder/progress";

export type TraineeAttemptRow = LadderAttemptRow & { therapist_id: string };

export type TraineeLadder = {
  therapistId: string;
  /** Keyed by program patient; patients the trainee never started are absent. */
  patients: Record<string, { attempts: LadderAttemptRow[]; progress: LadderProgress }>;
  clearedLevels: number;
  /** Attempts whose report came from the fallback examiner (not graded yet). */
  awaitingScore: number;
  lastAttemptAt: string;
};

/** Attempts grouped by trainee, most recently active first. */
export function summarizeTraineeLadders(
  attempts: readonly TraineeAttemptRow[],
): TraineeLadder[] {
  const byTrainee = new Map<string, TraineeAttemptRow[]>();
  for (const a of attempts) {
    const list = byTrainee.get(a.therapist_id) ?? [];
    list.push(a);
    byTrainee.set(a.therapist_id, list);
  }
  const ladders: TraineeLadder[] = [];
  for (const [therapistId, own] of byTrainee) {
    const patients: TraineeLadder["patients"] = {};
    for (const key of new Set(own.map((a) => a.patient_key))) {
      const mine = own.filter((a) => a.patient_key === key);
      patients[key] = { attempts: mine, progress: ladderProgress(mine) };
    }
    ladders.push({
      therapistId,
      patients,
      clearedLevels: Object.values(patients).reduce(
        (sum, p) => sum + p.progress.clearedCount,
        0,
      ),
      awaitingScore: own.filter((a) => a.status === "awaiting_score").length,
      lastAttemptAt: own.reduce(
        (latest, a) => (a.created_at > latest ? a.created_at : latest),
        own[0]!.created_at,
      ),
    });
  }
  return ladders.sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt));
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * Every trainee's attempts, oldest first. `truncated` says the cap was hit,
 * so the page can say its totals are partial instead of showing them as whole.
 */
export async function loadAllLadderAttempts(
  supabase: SupabaseClient,
): Promise<
  | { available: true; attempts: TraineeAttemptRow[]; truncated: boolean }
  | { available: false }
> {
  const attempts: TraineeAttemptRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("training_ladder_attempts")
      .select(`therapist_id, ${LADDER_ATTEMPT_COLUMNS}`)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.warn("[training-ladder] admin attempts load failed", {
        error: error.message,
      });
      return { available: false };
    }
    const rows = (data ?? []) as unknown as Array<
      Parameters<typeof normalizeLadderAttempt>[0] & { therapist_id: string }
    >;
    for (const raw of rows) {
      attempts.push({ ...normalizeLadderAttempt(raw), therapist_id: raw.therapist_id });
    }
    if (rows.length < PAGE_SIZE) return { available: true, attempts, truncated: false };
  }
  return { available: true, attempts, truncated: true };
}
