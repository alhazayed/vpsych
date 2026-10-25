import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CERTIFICATE_NUMBER_PATTERN,
  certificateIssuedDay,
  certificateVerifyLink,
  certificateVerifyPath,
  certificateWriteStatus,
  classifyCertificateWriteError,
  isRegistryMissing,
  issueCertificate,
  loadIssuedCertificates,
  mapCertificateRow,
  normalizeCertificateNumber,
  revokeCertificate,
  verifyCertificateNumber,
} from "@/lib/certificate-registry";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  verification_code: "VT-1A2B-3C4D-5E6F",
  recipient_name: "Lina Haddad",
  institution_name: null,
  locale: "ar",
  source: "training_ladder",
  issued_at: "2026-10-25T21:30:00+00:00",
  revoked: false,
  revoked_at: null,
  revoked_reason: null,
};

function rpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("normalizeCertificateNumber", () => {
  it("accepts the printed form", () => {
    expect(normalizeCertificateNumber("VT-1A2B-3C4D-5E6F")).toBe("VT-1A2B-3C4D-5E6F");
  });

  it("tolerates case, spaces, missing dashes and a missing prefix", () => {
    expect(normalizeCertificateNumber(" vt 1a2b 3c4d 5e6f ")).toBe("VT-1A2B-3C4D-5E6F");
    expect(normalizeCertificateNumber("1A2B3C4D5E6F")).toBe("VT-1A2B-3C4D-5E6F");
  });

  it("reads O, I and L as the digits they look like", () => {
    expect(normalizeCertificateNumber("VT-1O2B-3C4D-5E6I")).toBe("VT-102B-3C4D-5E61");
    expect(normalizeCertificateNumber("VT-L000-0000-0000")).toBe("VT-1000-0000-0000");
  });

  it("refuses anything that cannot be a number", () => {
    expect(normalizeCertificateNumber("")).toBeNull();
    expect(normalizeCertificateNumber("VT-20261025-ABCDEF")).toBeNull();
    expect(normalizeCertificateNumber("VT-1A2B-3C4D-5E6G")).toBeNull();
    expect(normalizeCertificateNumber("VT-1A2B-3C4D")).toBeNull();
    expect(normalizeCertificateNumber(42)).toBeNull();
    expect(normalizeCertificateNumber("x".repeat(100))).toBeNull();
  });

  it("always returns the database format", () => {
    expect(normalizeCertificateNumber("abcdef012345")).toMatch(CERTIFICATE_NUMBER_PATTERN);
  });
});

describe("links and dates", () => {
  it("builds the verify path and the printed link", () => {
    expect(certificateVerifyPath("VT-1A2B-3C4D-5E6F")).toBe("/verify?code=VT-1A2B-3C4D-5E6F");
    expect(certificateVerifyLink("VT-1A2B-3C4D-5E6F")).toBe(
      "www.vtraining.app/verify?code=VT-1A2B-3C4D-5E6F",
    );
  });

  it("uses the UTC day of the issue time, as /verify does", () => {
    expect(certificateIssuedDay("2026-10-25T23:30:00+00:00")).toBe("2026-10-25");
    expect(certificateIssuedDay("2026-10-26T01:30:00+03:00")).toBe("2026-10-25");
    expect(certificateIssuedDay("not a date")).toBe("");
  });
});

describe("row mapping", () => {
  it("maps a database row", () => {
    expect(mapCertificateRow(row)).toEqual({
      id: row.id,
      userId: row.user_id,
      number: "VT-1A2B-3C4D-5E6F",
      recipientName: "Lina Haddad",
      institutionName: null,
      locale: "ar",
      source: "training_ladder",
      issuedAt: row.issued_at,
      revoked: false,
      revokedAt: null,
      revokedReason: null,
    });
  });

  it("falls back for unexpected values", () => {
    const mapped = mapCertificateRow({ ...row, locale: null, source: null, revoked: null });
    expect(mapped.locale).toBe("en");
    expect(mapped.source).toBe("admin");
    expect(mapped.revoked).toBe(false);
  });
});

describe("errors", () => {
  it("recognises an unapplied migration", () => {
    expect(isRegistryMissing({ code: "PGRST202", message: "x" })).toBe(true);
    expect(isRegistryMissing({ code: "42703", message: "column does not exist" })).toBe(true);
    expect(
      isRegistryMissing({ message: "Could not find the function public.verify_training_certificate" }),
    ).toBe(true);
    expect(isRegistryMissing({ code: "42501", message: "forbidden" })).toBe(false);
    expect(isRegistryMissing(null)).toBe(false);
  });

  it("classifies RPC refusals", () => {
    expect(classifyCertificateWriteError({ message: "already_issued" })).toBe("already_issued");
    expect(classifyCertificateWriteError({ message: "already_revoked" })).toBe("already_revoked");
    expect(classifyCertificateWriteError({ code: "42501", message: "forbidden" })).toBe("forbidden");
    expect(classifyCertificateWriteError({ message: "certificate_not_found" })).toBe("not_found");
    expect(classifyCertificateWriteError({ message: "recipient_name_required" })).toBe("invalid");
    expect(classifyCertificateWriteError({ code: "PGRST202", message: "x" })).toBe("not_set_up");
    expect(classifyCertificateWriteError({ message: "connection reset" })).toBe("failed");
  });

  it("maps refusals to HTTP statuses", () => {
    expect(certificateWriteStatus("forbidden")).toBe(403);
    expect(certificateWriteStatus("already_issued")).toBe(409);
    expect(certificateWriteStatus("not_found")).toBe(404);
    expect(certificateWriteStatus("invalid")).toBe(400);
    expect(certificateWriteStatus("not_set_up")).toBe(503);
    expect(certificateWriteStatus("failed")).toBe(500);
  });
});

describe("verifyCertificateNumber", () => {
  it("does not query for an invalid number", async () => {
    const { client, rpc } = rpcClient({ data: [], error: null });
    expect(await verifyCertificateNumber(client, "nope")).toEqual({ status: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends the normalized number", async () => {
    const { client, rpc } = rpcClient({ data: [], error: null });
    expect(await verifyCertificateNumber(client, "vt1a2b3c4d5e6f")).toEqual({ status: "not_found" });
    expect(rpc).toHaveBeenCalledWith("verify_training_certificate", { p_code: "VT-1A2B-3C4D-5E6F" });
  });

  it("reports valid and revoked certificates", async () => {
    const found = {
      certificate_number: "VT-1A2B-3C4D-5E6F",
      recipient_name: "Lina Haddad",
      institution_name: "University of Jordan",
      issued_at: "2026-10-25T21:30:00+00:00",
      revoked: false,
      revoked_at: null,
    };
    const valid = await verifyCertificateNumber(
      rpcClient({ data: [found], error: null }).client,
      "VT-1A2B-3C4D-5E6F",
    );
    expect(valid.status).toBe("valid");
    const revoked = await verifyCertificateNumber(
      rpcClient({
        data: [{ ...found, revoked: true, revoked_at: "2026-10-26T08:00:00+00:00" }],
        error: null,
      }).client,
      "VT-1A2B-3C4D-5E6F",
    );
    expect(revoked).toMatchObject({ status: "revoked", certificate: { revoked: true } });
  });

  it("is unavailable when the lookup fails", async () => {
    const { client } = rpcClient({ data: null, error: { code: "PGRST202", message: "missing" } });
    expect(await verifyCertificateNumber(client, "VT-1A2B-3C4D-5E6F")).toEqual({
      status: "unavailable",
    });
  });
});

describe("issue and revoke", () => {
  it("returns the issued certificate", async () => {
    const { client, rpc } = rpcClient({ data: { ...row, source: "admin" }, error: null });
    const result = await issueCertificate(client, {
      userId: row.user_id,
      recipientName: "Lina Haddad",
      institutionName: null,
      locale: "ar",
    });
    expect(result).toMatchObject({ ok: true, certificate: { number: row.verification_code, source: "admin" } });
    expect(rpc).toHaveBeenCalledWith("admin_issue_training_certificate", {
      p_user_id: row.user_id,
      p_recipient_name: "Lina Haddad",
      p_institution_name: null,
      p_locale: "ar",
    });
  });

  it("passes a refusal through", async () => {
    const { client } = rpcClient({ data: null, error: { code: "23505", message: "already_issued" } });
    expect(
      await issueCertificate(client, {
        userId: row.user_id,
        recipientName: "x",
        institutionName: null,
        locale: "en",
      }),
    ).toEqual({ ok: false, error: "already_issued" });
  });

  it("revokes with a reason", async () => {
    const { client, rpc } = rpcClient({
      data: { ...row, revoked: true, revoked_at: "2026-10-26T08:00:00+00:00", revoked_reason: "typo" },
      error: null,
    });
    const result = await revokeCertificate(client, { certificateId: row.id, reason: "typo" });
    expect(result).toMatchObject({ ok: true, certificate: { revoked: true, revokedReason: "typo" } });
    expect(rpc).toHaveBeenCalledWith("admin_revoke_training_certificate", {
      p_certificate_id: row.id,
      p_reason: "typo",
    });
  });
});

describe("loadIssuedCertificates", () => {
  function tableClient(result: { data: unknown; error: unknown }) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => Promise.resolve(result),
    };
    return { from: () => chain } as unknown as SupabaseClient;
  }

  it("maps rows", async () => {
    const result = await loadIssuedCertificates(tableClient({ data: [row], error: null }));
    expect(result).toMatchObject({ status: "ok", certificates: [{ number: row.verification_code }] });
  });

  it("reports an unapplied migration as not set up", async () => {
    const result = await loadIssuedCertificates(
      tableClient({ data: null, error: { code: "42703", message: "column program does not exist" } }),
    );
    expect(result).toEqual({ status: "not_set_up" });
  });

  it("reports other failures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await loadIssuedCertificates(
      tableClient({ data: null, error: { code: "57014", message: "timeout" } }),
    );
    expect(result).toEqual({ status: "failed" });
  });
});
