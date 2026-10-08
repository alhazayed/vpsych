import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
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

function fakeClient(localName: string | null) {
  const selects: Record<string, string[]> = {};
  const results: Record<string, Result> = {
    training_ladder_patients: {
      data: [
        {
          key: "ethan",
          avatar_id: ETHAN.id,
          avatars: { ...ETHAN, local_name: localName },
        },
      ],
      error: null,
    },
    training_ladder_attempts: { data: [], error: null },
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
    const { client, selects } = fakeClient("أحمد حدّاد");
    const overview = await loadLadderOverview(client, "t1", "ar");
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("أحمد حدّاد");
    expect(overview.patients[0]!.avatar.name).toBe("Ethan Cole");
    expect(selects.training_ladder_patients?.[0]).toContain(
      "local_name:personalities->ar-JO->identity->>display_name",
    );
  });

  it("reads the English personality in English", async () => {
    const { client, selects } = fakeClient("Ethan Cole");
    const overview = await loadLadderOverview(client, "t1", "en");
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("Ethan Cole");
    expect(selects.training_ladder_patients?.[0]).toContain(
      "personalities->en-US->",
    );
  });

  it("keeps the canonical name when a locale has no authored name", async () => {
    const { client } = fakeClient(null);
    const overview = await loadLadderOverview(client, "t1", "ar");
    if (!overview.available) throw new Error("unavailable");
    expect(overview.patients[0]!.avatar.display_name).toBe("Ethan Cole");
  });
});
