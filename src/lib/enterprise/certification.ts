/**
 * Certification Engine — Stage 10 (organization / board / OSCE / digital).
 * Conservative issuance. Distinct from Education/Supervisor milestones —
 * those remain owned by Stage 7/9. This engine issues org-scoped credentials.
 */

import { createHash } from "node:crypto";
import type {
  CertificateKind,
  CertificateVerification,
  DigitalCertificate,
} from "@/lib/enterprise/types";
import { ENTERPRISE_CERT_ENGINE_VERSION } from "@/lib/enterprise/types";

export { ENTERPRISE_CERT_ENGINE_VERSION };

export const CERTIFICATE_KINDS: readonly CertificateKind[] = [
  "competency",
  "course",
  "university",
  "board_prep",
  "residency_milestone",
  "osce",
  "cme",
  "digital",
] as const;

function verificationCode(parts: string[]): string {
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
}

export function issueCertificate(input: {
  id?: string;
  organization_id: string;
  user_id: string;
  kind: CertificateKind;
  title: string;
  issued_at?: string;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}): DigitalCertificate {
  const issued_at = input.issued_at ?? new Date().toISOString();
  const id =
    input.id ??
    `cert_${input.organization_id}_${input.user_id}_${input.kind}_${issued_at.slice(0, 10)}`;
  const code = verificationCode([
    id,
    input.organization_id,
    input.user_id,
    input.kind,
    issued_at,
  ]);
  const qr_payload = JSON.stringify({
    v: ENTERPRISE_CERT_ENGINE_VERSION,
    code,
    org: input.organization_id,
    kind: input.kind,
  });
  return {
    id,
    organization_id: input.organization_id,
    user_id: input.user_id,
    kind: input.kind,
    title: input.title,
    issued_at,
    expires_at: input.expires_at ?? null,
    verification_code: code,
    qr_payload,
    metadata: {
      ...input.metadata,
      disclaimer:
        "Educational credential. Not a validated clinical license. Scores are formative.",
    },
    revoked: false,
  };
}

export function revokeCertificate(cert: DigitalCertificate): DigitalCertificate {
  return { ...cert, revoked: true };
}

export function verifyCertificate(
  code: string,
  registry: DigitalCertificate[],
  at: Date = new Date(),
): CertificateVerification {
  const found = registry.find((c) => c.verification_code === code);
  if (!found) {
    return { valid: false, certificate: null, reason: "not_found" };
  }
  if (found.revoked) {
    return { valid: false, certificate: found, reason: "revoked" };
  }
  if (found.expires_at && new Date(found.expires_at).getTime() < at.getTime()) {
    return { valid: false, certificate: found, reason: "expired" };
  }
  return { valid: true, certificate: found, reason: null };
}

/** Conservative OSCE pass — mirrors Stage 7/9 "no inflation" rule. */
export function evaluateOscePass(opts: {
  overall: number;
  station_scores: number[];
  pass_threshold?: number;
}): { passed: boolean; mean: number; threshold: number } {
  const threshold = opts.pass_threshold ?? 70;
  const mean =
    opts.station_scores.length === 0
      ? opts.overall
      : opts.station_scores.reduce((a, b) => a + b, 0) /
        opts.station_scores.length;
  const combined = (opts.overall + mean) / 2;
  return { passed: combined >= threshold, mean: combined, threshold };
}

export function boardPrepProgress(opts: {
  sessions_completed: number;
  target_sessions: number;
  overall_ema: number;
  domain_floors_met: boolean;
}): { pct: number; ready: boolean } {
  const sessionPct = Math.min(
    100,
    (opts.sessions_completed / Math.max(1, opts.target_sessions)) * 100,
  );
  const scorePct = Math.min(100, opts.overall_ema);
  const pct = Math.round(sessionPct * 0.5 + scorePct * 0.5);
  const ready =
    opts.sessions_completed >= opts.target_sessions &&
    opts.overall_ema >= 75 &&
    opts.domain_floors_met;
  return { pct, ready };
}
