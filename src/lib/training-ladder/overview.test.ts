import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadLadderOverview } from "@/lib/training-ladder/overview";

type Result = { data: unknown; error: { message: string } | null };

/** A thenable query that records its select and ignores filters. */
function query(result: Result, selects: string[]) {
  const q = {
    select(columns: string) {
      selects.push(columns);
      return q;
    },
    eq: () => q,
    in: () => q,
    order: () => q,
    then: (resolve: (r: Result) => unknown) => Promise.resolve(resolve(result)),
  };
  return q;
}

const ETHAN = {
  id: "a-ethan",
  name: "Ethan Cole",
  age: 27,
  gender: "male",
  portrait_url: "/avatars/ethan-cole.svg",
  is_active: true,
};

function fakeClient(names: Result) {
  const selects: Record<string, string[]> = {};
  const results: Record<string, Result> = {
    training_ladder_patients: {
      data: [{ key: "ethan", avatar_id: ETHAN.id, avatars: ETHAN }],
      error: null,
    },
    training_ladder_attempts: { data: [], error: null },
    avatars: names,
  };
  const client = {
    from(table: string) {
      selects[table] ??= [];
      return query(results[table]!, selects[table]!);
    },
  };
  return { client: client as unknown as SupabaseClient, selects };
}

describe("loadLadderOverview names", () => {
  it("shows the patient's natively authored Arabic name in Arabic", async () => {
    const { client, selects } = fakeClient({
      data: [{ id: ETHAN.id, local_name: "أحمد حدّاد" }],
      error: null,
    });
    const overview = await loadLadderOverview(client, "t1", "ar");
    expect(overview.available).toBe(true);
    if (!overview.available) return;
    expect(overview.patients[0]!.avatar.display_name).toBe("أحمد حدّاد");
    expect(overview.patients[0]!.avatar.name).toBe("Ethan Cole");
    expect(selects.avatars).toEqual([
      "id, local_name:personalities->ar-JO->identity->>display_name",
    ]);
  });

  it("reads the English personality in English", async () => {
    const { client, selects } = fakeClient({
      data: [{ id: ETHAN.id, local_name: "Ethan Cole" }],
      error: null,
    });
    const overview = await loadLadderOverview(client, "t1", "en");
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("Ethan Cole");
    expect(selects.avatars?.[0]).toContain("personalities->en-US->");
  });

  it("keeps the canonical name when the name lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    const overview = await loadLadderOverview(client, "t1", "ar");
    warn.mockRestore();
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("Ethan Cole");
  });

  it("keeps the canonical name when a locale has no authored name", async () => {
    const { client } = fakeClient({
      data: [{ id: ETHAN.id, local_name: null }],
      error: null,
    });
    const overview = await loadLadderOverview(client, "t1", "ar");
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("Ethan Cole");
  });
});
