"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  REVOKE_REASON_MAX,
  certificateVerifyPath,
  type CertificateWriteError,
  type IssuedCertificate,
} from "@/lib/certificate-registry";

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Recorded certificates with their status. An admin can open one in the
 * designer above to reprint it, check it on the public verify page, or
 * revoke it (with an optional reason) after confirming.
 */
export function IssuedCertificatesPanel({
  certificates,
  showableUserIds,
  onShow,
  onRevoked,
}: {
  certificates: IssuedCertificate[];
  showableUserIds: ReadonlySet<string>;
  onShow: (userId: string) => void;
  onRevoked: (certificate: IssuedCertificate) => void;
}) {
  const t = useTranslations("admin.certificates");
  const locale = useLocale();
  const ids = useId();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRevoke = (id: string) => {
    setRevokingId(id);
    setReason("");
    setError(null);
  };

  async function confirmRevoke(certificate: IssuedCertificate) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/certificates/${certificate.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { certificate?: IssuedCertificate; code?: CertificateWriteError }
        | null;
      if (!res.ok || !body?.certificate) {
        const code = body?.code ?? "failed";
        setError(t(`revokeErrors.${code}`));
        return;
      }
      onRevoked(body.certificate);
      setRevokingId(null);
    } catch {
      setError(t("revokeErrors.network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="clinical-card space-y-3 p-4">
      <div>
        <h2 id={`${ids}-title`} className="text-base font-semibold text-[var(--on-surface)]">
          {t("registryTitle")}
        </h2>
        <p className="text-xs text-[var(--on-surface-variant)]">{t("registrySubtitle")}</p>
      </div>

      {certificates.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("registryEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-xs text-[var(--on-surface-variant)]">
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colNumber")}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colName")}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colIssued")}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colSource")}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colStatus")}</th>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((c) => (
                <tr key={c.id} className="border-b border-[var(--outline-variant)] align-top last:border-0">
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums" dir="ltr">
                    {c.number}
                  </td>
                  <td className="px-2 py-2" dir="auto">
                    {c.recipientName ?? (
                      <span className="text-[var(--on-surface-variant)]">{t("nameMissing")}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(c.issuedAt, locale)}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {c.source === "training_ladder" ? t("sourceAuto") : t("sourceAdmin")}
                  </td>
                  <td className="px-2 py-2">
                    {c.revoked ? (
                      <span className="text-[var(--error)]">
                        {t("statusRevoked", { date: c.revokedAt ? formatDate(c.revokedAt, locale) : "" })}
                        {c.revokedReason ? (
                          <span className="block text-xs text-[var(--on-surface-variant)]" dir="auto">
                            {c.revokedReason}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--primary)]">{t("statusValid")}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!c.revoked && showableUserIds.has(c.userId) ? (
                        <button
                          type="button"
                          className="btn-secondary min-h-9 px-2 text-xs"
                          onClick={() => onShow(c.userId)}
                        >
                          {t("show")}
                        </button>
                      ) : null}
                      <a
                        href={certificateVerifyPath(c.number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary inline-flex min-h-9 items-center px-2 text-xs"
                      >
                        {t("verifyOpen")}
                      </a>
                      {!c.revoked && revokingId !== c.id ? (
                        <button
                          type="button"
                          className="min-h-9 rounded-lg px-2 text-xs font-medium text-[var(--error)] hover:underline"
                          onClick={() => startRevoke(c.id)}
                        >
                          {t("revoke")}
                        </button>
                      ) : null}
                    </div>
                    {revokingId === c.id ? (
                      <div
                        role="group"
                        aria-labelledby={`${ids}-revoke-${c.id}`}
                        className="mt-2 space-y-2 rounded-lg border border-[var(--error)] p-3"
                      >
                        <p id={`${ids}-revoke-${c.id}`} className="text-sm font-semibold">
                          {t("revokeTitle", { number: c.number })}
                        </p>
                        <label htmlFor={`${ids}-reason-${c.id}`} className="block text-xs font-medium">
                          {t("revokeReason")}
                        </label>
                        <input
                          id={`${ids}-reason-${c.id}`}
                          value={reason}
                          maxLength={REVOKE_REASON_MAX}
                          onChange={(e) => setReason(e.target.value)}
                          dir="auto"
                          className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                        />
                        <p className="text-xs text-[var(--on-surface-variant)]">{t("revokeHint")}</p>
                        {error ? (
                          <p role="alert" className="text-xs text-[var(--error)]">
                            {error}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmRevoke(c)}
                            className="inline-flex min-h-9 items-center rounded-lg border border-[var(--error)] bg-[var(--error-container)] px-3 text-xs font-semibold text-[var(--on-error-container)] disabled:opacity-60"
                          >
                            {busy ? t("revoking") : t("revokeConfirm")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRevokingId(null)}
                            className="btn-secondary min-h-9 px-3 text-xs"
                          >
                            {t("revokeCancel")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
