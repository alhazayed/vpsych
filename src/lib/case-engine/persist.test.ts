import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCaseForSession } from "@/lib/case-engine/persist";
import type { Avatar } from "@/lib/types";

/**
 * Characterization tests for `createCaseForSession`.
 *
 * These pin the behaviour the function has TODAY — including the
 * migration-missing fallbacks that report `ok: true` without a persisted row.
 * They are a safety net for refactoring the 583-line body, not an assertion
 * that every behaviour below is desirable. Where a test documents something
 * questionable it says so in a comment; fixing it is a separate change that
 * should update the test deliberately.
 */

type QueryResult = {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
};

type Recorded = { table: string; op: "insert" | "update"; payload: unknown };

/**
 * Minimal stand-in for the PostgREST builder. Every chain method returns the
 * same node; the node is awaitable and also answers maybeSingle()/single().
 * `reads` configures what a table returns when queried, `writes` what an
 * insert returns.
 */
function makeClient(cfg: {
  reads?: Record<string, QueryResult>;
  writes?: Record<string, QueryResult>;
}) {
  const recorded: Recorded[] = [];
  const read = (table: string): QueryResult =>
    cfg.reads?.[table] ?? { data: null, error: null };

  const client = {
    from(table: string) {
      let writeResult: QueryResult | undefined;
      const node = {
        select: () => node,
        eq: () => node,
        order: () => node,
        insert(payload: unknown) {
          recorded.push({ table, op: "insert", payload });
          writeResult = cfg.writes?.[table] ?? {
            data: { id: `${table}-row-1` },
            error: null,
          };
          return node;
        },
        update(payload: unknown) {
          recorded.push({ table, op: "update", payload });
          return node;
        },
        maybeSingle: async () => writeResult ?? read(table),
        single: async () => writeResult ?? read(table),
        then<T>(
          onOk: (v: QueryResult) => T,
          onErr?: (e: unknown) => T,
        ): Promise<T> {
          return Promise.resolve(writeResult ?? read(table)).then(onOk, onErr);
        },
      };
      return node;
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    recorded,
    inserted: (table: string) =>
      recorded.filter((r) => r.table === table && r.op === "insert"),
  };
}

const mayaAvatar: Avatar = {
  id: "avatar-maya",
  name: "Maya Chen",
  slug: "maya-chen",
  disorder: "Major Depressive Disorder",
  age: 28,
  gender: "female",
  portrait_url: null,
  persona_prompt: "",
  ideal_guidelines: {},
  rubric: [],
  // Required: personaFromAvatar copies is_active onto the synthesized persona,
  // and case validation rejects an inactive persona with 400.
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const baseOpts = {
  avatar: mayaAvatar,
  locale: "en-US",
  therapistId: "therapist-1",
};

describe("createCaseForSession — plain path", () => {
  it("persists a case instance and returns the database row id", async () => {
    const { client, inserted } = makeClient({
      writes: { case_instances: { data: { id: "ci-persisted" }, error: null } },
    });

    const result = await createCaseForSession(client, baseOpts);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.caseInstanceId).toBe("ci-persisted");
    expect(result.snapshot.case_instance_id).toBe("ci-persisted");
    expect(inserted("case_instances")).toHaveLength(1);
  });

  it("writes case_memory scoped to the case instance", async () => {
    const { client, inserted } = makeClient({
      writes: { case_instances: { data: { id: "ci-1" }, error: null } },
    });

    await createCaseForSession(client, baseOpts);

    const mem = inserted("case_memory");
    expect(mem).toHaveLength(1);
    expect(mem[0].payload).toMatchObject({
      case_instance_id: "ci-1",
      memory: { scope: "case_instance", turns: [], notes: [] },
    });
  });

  it("re-updates the row so the snapshot carries its own case_instance_id", async () => {
    const { client, recorded } = makeClient({
      writes: { case_instances: { data: { id: "ci-2" }, error: null } },
    });

    await createCaseForSession(client, baseOpts);

    const update = recorded.find(
      (r) => r.table === "case_instances" && r.op === "update",
    );
    expect(update).toBeDefined();
    expect(
      (update?.payload as { clinical_snapshot: { case_instance_id: string } })
        .clinical_snapshot.case_instance_id,
    ).toBe("ci-2");
  });

  it("keeps locale separate from diagnosis (ar-JO yields the same disorder)", async () => {
    const en = makeClient({});
    const ar = makeClient({});

    const enResult = await createCaseForSession(en.client, baseOpts);
    const arResult = await createCaseForSession(ar.client, {
      ...baseOpts,
      locale: "ar-JO",
    });

    expect(enResult.ok && arResult.ok).toBe(true);
    if (!enResult.ok || !arResult.ok) return;
    expect(arResult.snapshot.locale).toBe("ar-JO");
    expect(arResult.snapshot.clinical_core.disorder).toBe(
      enResult.snapshot.clinical_core.disorder,
    );
  });

  it("mints a distinct assessment id per call for the same avatar", async () => {
    const a = await createCaseForSession(makeClient({}).client, baseOpts);
    const b = await createCaseForSession(makeClient({}).client, baseOpts);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.snapshot.assessment_id).not.toBe(b.snapshot.assessment_id);
  });

  it("rejects an unknown comorbidity slug with 400", async () => {
    const { client } = makeClient({});

    const result = await createCaseForSession(client, {
      ...baseOpts,
      comorbiditySlugs: ["not-a-real-disorder"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain("not-a-real-disorder");
  });
});

describe("createCaseForSession — migration-missing fallbacks", () => {
  // Documented in docs/DYNAMIC_CLINICAL_CASE_ENGINE.md ("Backward compatibility"):
  // when the engine tables are absent the session still starts, carrying the
  // snapshot without a persisted row.
  it("returns ok with the assessment id when case_instances is absent (42P01)", async () => {
    const { client, inserted } = makeClient({
      writes: {
        case_instances: {
          data: null,
          error: { code: "42P01", message: 'relation "case_instances" does not exist' },
        },
      },
    });

    const result = await createCaseForSession(client, baseOpts);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The returned id is the in-memory assessment id, NOT a database row.
    expect(result.caseInstanceId).toBe(result.snapshot.assessment_id);
    expect(inserted("case_memory")).toHaveLength(0);
  });

  it("surfaces a genuine insert failure as 500 on the plain path", async () => {
    const { client } = makeClient({
      writes: {
        case_instances: {
          data: null,
          error: { code: "23505", message: "duplicate key value" },
        },
      },
    });

    const result = await createCaseForSession(client, baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
    expect(result.error).toContain("duplicate key");
  });
});

describe("createCaseForSession — preset path", () => {
  it("returns 404 when the preset resolves from neither database nor builtins", async () => {
    const { client } = makeClient({});

    const result = await createCaseForSession(client, {
      ...baseOpts,
      presetSlug: "no-such-preset",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.error).toBe("Instructor preset not found");
  });

  it("surfaces a foreign-key violation naming the preset constraint as 500", async () => {
    // Regression guard. This branch used to match the bare substring
    // "instructor_preset", which reported a genuine foreign-key violation on
    // case_instances_instructor_preset_id_fkey as success with a case id that
    // had no row behind it. Only a missing relation (42P01) may fall back.
    const { client } = makeClient({
      reads: {
        instructor_presets: {
          data: null,
          error: null,
        },
      },
      writes: {
        case_instances: {
          data: null,
          error: {
            code: "23503",
            message:
              'insert or update on table "case_instances" violates foreign key constraint "case_instances_instructor_preset_id_fkey"',
          },
        },
      },
    });

    const result = await createCaseForSession(client, {
      ...baseOpts,
      presetSlug: "foundation-interview-medstudent-en",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
    expect(result.error).toContain("foreign key constraint");
  });
});

describe("createCaseForSession — template path", () => {
  it("returns 404 when the template resolves from neither database nor builtins", async () => {
    const { client } = makeClient({});

    const result = await createCaseForSession(client, {
      ...baseOpts,
      templateSlug: "no-such-template",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.error).toBe("Clinical template not found");
  });

  it("surfaces a foreign-key violation naming the template constraint as 500", async () => {
    // Regression guard, same shape as the preset case. This branch used to
    // match the bare substring "template_id" — a common column name, so the
    // clause was broader still. Only a missing relation (42P01) may fall back.
    const { client } = makeClient({
      writes: {
        case_instances: {
          data: null,
          error: {
            code: "23503",
            message:
              'insert or update on table "case_instances" violates foreign key constraint "case_instances_template_id_fkey"',
          },
        },
      },
    });

    const result = await createCaseForSession(client, {
      ...baseOpts,
      templateSlug: "adult-mdd-initial-en",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
    expect(result.error).toContain("foreign key constraint");
  });
});

describe("createCaseForSession — admin-test persona override", () => {
  it("allowInactivePersona does not write persona or avatar state", async () => {
    const { client, recorded } = makeClient({
      reads: {
        personas: {
          data: {
            id: "persona-1",
            avatar_id: "avatar-maya",
            slug: "maya-chen",
            display_name: "Maya Chen",
            identity: { age: 28, gender: "female" },
            traits: {},
            baseline_history: {},
            default_disorder_id: null,
            is_active: false,
          },
          error: null,
        },
      },
    });

    const result = await createCaseForSession(client, {
      ...baseOpts,
      allowInactivePersona: true,
    });

    expect(result.ok).toBe(true);
    expect(recorded.some((r) => r.table === "personas")).toBe(false);
    expect(recorded.some((r) => r.table === "avatars")).toBe(false);
  });
});
