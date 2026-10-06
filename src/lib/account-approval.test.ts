import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAccountApproved,
  isApprovalExemptPath,
  isMissingApprovalColumnError,
  parseApprovalDecision,
  resolveApprovalStatus,
} from "./account-approval";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("resolveApprovalStatus", () => {
  it("only an approved therapist is approved", () => {
    expect(resolveApprovalStatus({ role: "therapist", approval_status: "approved" })).toBe("approved");
    expect(resolveApprovalStatus({ role: "therapist", approval_status: "pending" })).toBe("pending");
    expect(resolveApprovalStatus({ role: "therapist", approval_status: "rejected" })).toBe("rejected");
  });

  it("admins are always approved", () => {
    expect(resolveApprovalStatus({ role: "admin", approval_status: "pending" })).toBe("approved");
  });

  it("fails closed on a missing profile or unknown value", () => {
    expect(resolveApprovalStatus(null)).toBe("pending");
    expect(resolveApprovalStatus({ role: "therapist", approval_status: null })).toBe("pending");
    expect(resolveApprovalStatus({ role: "therapist", approval_status: "yes" })).toBe("pending");
  });

  it("treats a row without the column (migration not applied) as approved", () => {
    expect(resolveApprovalStatus({ role: "therapist" })).toBe("approved");
    expect(isAccountApproved({ role: "therapist" })).toBe(true);
  });
});

describe("isApprovalExemptPath", () => {
  it("lets an unapproved user reach only the pending screen and auth flows", () => {
    expect(isApprovalExemptPath("/pending")).toBe(true);
    expect(isApprovalExemptPath("/auth/mfa")).toBe(true);
    expect(isApprovalExemptPath("/auth/reset-password")).toBe(true);
    expect(isApprovalExemptPath("/avatars")).toBe(false);
    expect(isApprovalExemptPath("/sessions/abc")).toBe(false);
    expect(isApprovalExemptPath("/api/sessions")).toBe(false);
    expect(isApprovalExemptPath("/pendingx")).toBe(false);
  });
});

describe("parseApprovalDecision", () => {
  it("maps admin decisions onto stored statuses", () => {
    expect(parseApprovalDecision("approve")).toBe("approved");
    expect(parseApprovalDecision("reject")).toBe("rejected");
    expect(parseApprovalDecision("pending")).toBe("pending");
    expect(parseApprovalDecision("approved")).toBeNull();
    expect(parseApprovalDecision(undefined)).toBeNull();
  });
});

describe("isMissingApprovalColumnError", () => {
  it("recognises only the undefined-column error", () => {
    expect(isMissingApprovalColumnError({ code: "42703", message: "column profiles.approval_status does not exist" })).toBe(true);
    expect(isMissingApprovalColumnError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingApprovalColumnError(null)).toBe(false);
  });
});

describe("approval gate wiring", () => {
  it("middleware confines unapproved accounts to the pending screen", () => {
    const src = read("src/lib/supabase/middleware.ts");
    expect(src).toMatch(/needsApproval && approval !== "approved"/);
    expect(src).toContain("PENDING_APPROVAL_PATH");
    expect(src).toContain("ACCOUNT_NOT_APPROVED_CODE");
  });

  it("requireProfile and requireApiUser both check approval", () => {
    expect(read("src/lib/auth.ts")).toContain("isAccountApproved(profile)");
    expect(read("src/lib/api-auth.ts")).toContain("isAccountApproved(profile)");
  });

  it("migration starts new sign-ups pending and guards the column", () => {
    const sql = read("supabase/migrations/20261006080000_account_approval.sql");
    expect(sql).toMatch(/ALTER COLUMN approval_status SET DEFAULT 'pending'/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.profiles/);
    expect(sql).toMatch(/ON public\.sessions\s+AS RESTRICTIVE/);
    expect(sql).toMatch(/ON public\.session_messages\s+AS RESTRICTIVE/);
    expect(sql).toContain("(select public.is_approved())");
  });
});
