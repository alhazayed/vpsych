/**
 * Issued Training Program certificates, kept in `enterprise_certificates`
 * (migration 20261025220000_verifiable_training_certificates).
 *
 * - A trainee who clears every Training Program level gets one automatically
 *   (database trigger); an admin can issue one by hand and revoke any.
 * - Anyone can check a certificate number at /verify. Verification returns
 *   only what the printed sheet already shows.
 *
 * Until the migration is applied every call reports `not_set_up`, and the
 * admin page falls back to printing an unrecorded sheet, so nothing breaks.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCertificateLocale, type CertificateLocale } from "@/lib/certificate-template";

/** Printed number: `VT-` and three groups of four upper-case hex digits. */
export const CERTIFICATE_NUMBER_PATTERN = /^VT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

/** Public site the printed verify link points at. */
export const CERTIFICATE_VERIFY_ORIGIN = "https://www.vtraining.app";

export const REVOKE_REASON_MAX = 300;

export type CertificateSource = "training_ladder" | "admin";

export type IssuedCertificate = {
  id: string;
  userId: string;
  number: string;
  recipientName: string | null;
  institutionName: string | null;
  locale: CertificateLocale;
  source: CertificateSource;
  issuedAt: string;
  revoked: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type VerifiedCertificate = {
  number: string;
  recipientName: string | null;
  institutionName: string | null;
  issuedAt: string;
  revoked: boolean;
  revokedAt: string | null;
};

export type VerifyResult =
  | { status: "valid"; certificate: VerifiedCertificate }
  | { status: "revoked"; certificate: VerifiedCertificate }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * A number as typed or scanned, cleaned up: spaces and dashes are optional,
 * case does not matter, and the letters O / I / L read as 0 / 1 / 1 (the
 * number only uses hex digits). Null when it cannot be a certificate number.
 */
export function normalizeCertificateNumber(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  let s = raw.toUpperCase().replace(/[\s\-–—_.]/g, "");
  if (s.startsWith("VT")) s = s.slice(2);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!/^[0-9A-F]{12}$/.test(s)) return null;
  return `VT-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function certificateVerifyPath(number: string): string {
  return `/verify?code=${encodeURIComponent(number)}`;
}

/** What the printed sheet shows under the number, without the scheme. */
export function certificateVerifyLink(number: string): string {
  return `${CERTIFICATE_VERIFY_ORIGIN.replace(/^https?:\/\//, "")}${certificateVerifyPath(number)}`;
}

/** `YYYY-MM-DD` (UTC) of an issue timestamp: the date printed and verified. */
export function certificateIssuedDay(issuedAt: string): string {
  const date = new Date(issuedAt);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

type DbError = { code?: string; message?: string } | null | undefined;

/** The migration is not applied yet: missing function, column or table. */
export function isRegistryMissing(error: DbError): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (["PGRST202", "PGRST204", "PGRST205", "42883", "42703", "42P01"].includes(code)) return true;
  return /could not find the function|does not exist|schema cache/i.test(error.message ?? "");
}

export const CERTIFICATE_COLUMNS =
  "id, user_id, verification_code, recipient_name, institution_name, locale, source, issued_at, revoked, revoked_at, revoked_reason";

type CertificateRow = {
  id: string;
  user_id: string;
  verification_code: string;
  recipient_name: string | null;
  institution_name: string | null;
  locale: string | null;
  source: string | null;
  issued_at: string;
  revoked: boolean | null;
  revoked_at: string | null;
  revoked_reason: string | null;
};

export function mapCertificateRow(row: CertificateRow): IssuedCertificate {
  return {
    id: row.id,
    userId: row.user_id,
    number: row.verification_code,
    recipientName: row.recipient_name,
    institutionName: row.institution_name,
    locale: isCertificateLocale(row.locale) ? row.locale : "en",
    source: row.source === "training_ladder" ? "training_ladder" : "admin",
    issuedAt: row.issued_at,
    revoked: row.revoked === true,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  };
}

export type LoadCertificatesResult =
  | { status: "ok"; certificates: IssuedCertificate[] }
  | { status: "not_set_up" | "failed" };

/** Every Training Program certificate, newest first (admin: RLS). */
export async function loadIssuedCertificates(
  supabase: SupabaseClient,
): Promise<LoadCertificatesResult> {
  const { data, error } = await supabase
    .from("enterprise_certificates")
    .select(CERTIFICATE_COLUMNS)
    .eq("program", "training_program")
    .order("issued_at", { ascending: false })
    .limit(1000);
  if (error) {
    if (isRegistryMissing(error)) return { status: "not_set_up" };
    console.warn("[certificates] load failed", { code: error.code, error: error.message });
    return { status: "failed" };
  }
  return {
    status: "ok",
    certificates: ((data ?? []) as unknown as CertificateRow[]).map(mapCertificateRow),
  };
}

type VerifyRow = {
  certificate_number: string;
  recipient_name: string | null;
  institution_name: string | null;
  issued_at: string;
  revoked: boolean | null;
  revoked_at: string | null;
};

export async function verifyCertificateNumber(
  supabase: SupabaseClient,
  raw: unknown,
): Promise<VerifyResult> {
  const number = normalizeCertificateNumber(raw);
  if (!number) return { status: "invalid" };
  const { data, error } = await supabase.rpc("verify_training_certificate", { p_code: number });
  if (error) {
    if (!isRegistryMissing(error)) {
      console.warn("[certificates] verify failed", { code: error.code, error: error.message });
    }
    return { status: "unavailable" };
  }
  const row = (Array.isArray(data) ? data[0] : null) as VerifyRow | null | undefined;
  if (!row) return { status: "not_found" };
  const certificate: VerifiedCertificate = {
    number: row.certificate_number,
    recipientName: row.recipient_name,
    institutionName: row.institution_name,
    issuedAt: row.issued_at,
    revoked: row.revoked === true,
    revokedAt: row.revoked_at,
  };
  return certificate.revoked
    ? { status: "revoked", certificate }
    : { status: "valid", certificate };
}

export type CertificateWriteError =
  | "forbidden"
  | "already_issued"
  | "already_revoked"
  | "not_found"
  | "invalid"
  | "not_set_up"
  | "failed";

export type CertificateWriteResult =
  | { ok: true; certificate: IssuedCertificate }
  | { ok: false; error: CertificateWriteError };

export function classifyCertificateWriteError(error: DbError): CertificateWriteError {
  if (isRegistryMissing(error)) return "not_set_up";
  const message = error?.message ?? "";
  if (/already_issued/.test(message)) return "already_issued";
  if (/already_revoked/.test(message)) return "already_revoked";
  if (/forbidden/.test(message)) return "forbidden";
  if (/account_not_found|certificate_not_found/.test(message)) return "not_found";
  if (/recipient_name_required|text_too_long|invalid_locale/.test(message)) return "invalid";
  return "failed";
}

function oneRow(data: unknown): CertificateRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" && "id" in row ? (row as CertificateRow) : null;
}

export async function issueCertificate(
  supabase: SupabaseClient,
  params: {
    userId: string;
    recipientName: string;
    institutionName: string | null;
    locale: CertificateLocale;
  },
): Promise<CertificateWriteResult> {
  const { data, error } = await supabase.rpc("admin_issue_training_certificate", {
    p_user_id: params.userId,
    p_recipient_name: params.recipientName,
    p_institution_name: params.institutionName,
    p_locale: params.locale,
  });
  if (error) {
    const kind = classifyCertificateWriteError(error);
    if (kind === "failed") {
      console.error("[certificates] issue failed", { code: error.code, error: error.message });
    }
    return { ok: false, error: kind };
  }
  const row = oneRow(data);
  if (!row) return { ok: false, error: "failed" };
  return { ok: true, certificate: mapCertificateRow(row) };
}

export async function revokeCertificate(
  supabase: SupabaseClient,
  params: { certificateId: string; reason: string | null },
): Promise<CertificateWriteResult> {
  const { data, error } = await supabase.rpc("admin_revoke_training_certificate", {
    p_certificate_id: params.certificateId,
    p_reason: params.reason,
  });
  if (error) {
    const kind = classifyCertificateWriteError(error);
    if (kind === "failed") {
      console.error("[certificates] revoke failed", { code: error.code, error: error.message });
    }
    return { ok: false, error: kind };
  }
  const row = oneRow(data);
  if (!row) return { ok: false, error: "failed" };
  return { ok: true, certificate: mapCertificateRow(row) };
}

/** HTTP status for a refused write. */
export function certificateWriteStatus(error: CertificateWriteError): number {
  switch (error) {
    case "forbidden":
      return 403;
    case "already_issued":
    case "already_revoked":
      return 409;
    case "not_found":
      return 404;
    case "invalid":
      return 400;
    case "not_set_up":
      return 503;
    default:
      return 500;
  }
}
