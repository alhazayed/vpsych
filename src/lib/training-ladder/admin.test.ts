import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  loadAllLadderAttempts,
  summarizeTraineeLadders,
  type TraineeAttemptRow,
} from "@/lib/training-ladder/admin";

let n = 0;
function attempt(
  therapist_id: string,
  patient_key: string,
  level: number,
  status: TraineeAttemptRow["status"],
  created_at: string,
): TraineeAttemptRow {
  n += 1;
  return {
    id: `a${n}`,
    session_id: `s${n}`,
    therapist_id,
    patient_key,
    level,
    status,
    score: status === "passed" ? 70 : status === "failed" ? 40 : null,
    created_at,
    session_status: "completed",
  };
}

describe("summarizeTraineeLadders", () => {
  it("derives each trainee's progress per patient, as the trainee sees it", () => {
    const ladders = summarizeTraineeLadders([
      attempt("t1", "ethan", 1, "passed", "2026-10-10T09:00:00Z"),
      attempt("t1", "ethan", 2, "failed", "2026-10-11T09:00:00Z"),
      attempt("t1", "ethan", 2, "passed", "2026-10-12T09:00:00Z"),
      attempt("t1", "rachel", 1, "awaiting_score", "2026-10-12T10:00:00Z"),
      attempt("t2", "ethan", 1, "failed", "2026-10-13T09:00:00Z"),
    ]);
    expect(ladders.map((l) => l.therapistId)).toEqual(["t2", "t1"]);
    const t1 = ladders[1]!;
    expect(t1.patients.ethan!.progress.clearedCount).toBe(2);
    expect(t1.patients.ethan!.progress.currentLevel).toBe(3);
    expect(t1.patients.rachel!.progress.clearedCount).toBe(0);
    expect(t1.patients.laura).toBeUndefined();
    expect(t1.clearedLevels).toBe(2);
    expect(t1.awaitingScore).toBe(1);
    expect(t1.lastAttemptAt).toBe("2026-10-12T10:00:00Z");
    expect(ladders[0]!.clearedLevels).toBe(0);
  });

  it("is empty when nobody has started", () => {
    expect(summarizeTraineeLadders([])).toEqual([]);
  });
});

describe("loadAllLadderAttempts", () => {
  function client(result: { data: unknown; error: { message: string } | null }) {
    const selects: string[] = [];
    const q = {
      select(columns: string) {
        selects.push(columns);
        return q;
      },
      order: () => q,
      range: () => q,
      then: (resolve: (r: typeof result) => unknown) =>
        Promise.resolve(resolve(result)),
    };
    return {
      supabase: { from: () => q } as unknown as SupabaseClient,
      selects,
    };
  }

  it("keeps the trainee on every attempt", async () => {
    const { supabase, selects } = client({
      data: [
        {
          therapist_id: "t1",
          id: "a1",
          session_id: "s1",
          patient_key: "ethan",
          level: 1,
          status: "passed",
          score: "72.00",
          created_at: "2026-10-10T09:00:00Z",
          sessions: { status: "completed" },
        },
      ],
      error: null,
    });
    const result = await loadAllLadderAttempts(supabase);
    expect(selects[0]).toContain("therapist_id");
    expect(result).toMatchObject({
      available: true,
      truncated: false,
      attempts: [{ therapist_id: "t1", score: 72, session_status: "completed" }],
    });
  });

  it("reports a failed read instead of an empty program", async () => {
    const { supabase } = client({ data: null, error: { message: "boom" } });
    expect(await loadAllLadderAttempts(supabase)).toEqual({ available: false });
  });
});
