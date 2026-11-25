import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignedPatientStartError,
  isAssignmentSchemaMissing,
  loadAssignedPatientIds,
  PATIENT_NOT_ASSIGNED_CODE,
} from "@/lib/assigned-patients";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function client(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const eq = vi.fn(async () => result);
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, eq };
}

describe("assignedPatientStartError", () => {
  const base = { avatarId: A, skillTest: false, ladder: false, specificCase: false };

  it("never restricts a trainee with no assignment", () => {
    expect(assignedPatientStartError({ ...base, assigned: null, avatarId: B, ladder: true })).toBeNull();
  });

  it("allows a plain start with an assigned patient", () => {
    expect(assignedPatientStartError({ ...base, assigned: new Set([A]) })).toBeNull();
  });

  it("refuses a patient that is not assigned", () => {
    expect(assignedPatientStartError({ ...base, assigned: new Set([A]), avatarId: B })).toBe(
      PATIENT_NOT_ASSIGNED_CODE,
    );
  });

  it("refuses Training Program levels and chosen cases, which run outside a course", () => {
    const assigned = new Set([A]);
    expect(assignedPatientStartError({ ...base, assigned, ladder: true })).toBe(
      PATIENT_NOT_ASSIGNED_CODE,
    );
    expect(assignedPatientStartError({ ...base, assigned, specificCase: true })).toBe(
      PATIENT_NOT_ASSIGNED_CODE,
    );
  });

  it("still lets a supervisor's skill test start", () => {
    expect(
      assignedPatientStartError({ ...base, assigned: new Set([A]), avatarId: B, skillTest: true }),
    ).toBeNull();
  });
});

describe("loadAssignedPatientIds", () => {
  it("returns null (no restriction) when the trainee has no rows", async () => {
    const { client: c, from, eq } = client({ data: [], error: null });
    expect(await loadAssignedPatientIds(c, A)).toEqual({ ok: true, ids: null });
    expect(from).toHaveBeenCalledWith("trainee_patient_assignments");
    expect(eq).toHaveBeenCalledWith("trainee_id", A);
  });

  it("returns the assigned patient ids", async () => {
    const { client: c } = client({ data: [{ avatar_id: A }, { avatar_id: B }], error: null });
    const result = await loadAssignedPatientIds(c, A);
    expect(result.ok && result.ids && [...result.ids].sort()).toEqual([A, B].sort());
  });

  it("treats a missing table (migration pending) as no restriction", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client: c } = client({ data: null, error: { code: "PGRST205", message: "x" } });
    expect(await loadAssignedPatientIds(c, A)).toEqual({ ok: true, ids: null });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns a failure for any other read error", async () => {
    const { client: c } = client({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await loadAssignedPatientIds(c, A)).toEqual({ ok: false, code: "57014" });
  });

  it("recognises missing-table errors by code or message", () => {
    expect(isAssignmentSchemaMissing({ code: "42P01" })).toBe(true);
    expect(
      isAssignmentSchemaMissing({
        message: "Could not find the table 'public.trainee_patient_assignments' in the schema cache",
      }),
    ).toBe(true);
    expect(isAssignmentSchemaMissing({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isAssignmentSchemaMissing(null)).toBe(false);
  });
});
