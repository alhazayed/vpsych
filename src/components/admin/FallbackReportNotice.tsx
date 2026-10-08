"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Code =
  | "ai_unavailable"
  | "not_heuristic"
  | "concurrent_update"
  | "report_not_found"
  | "session_not_found";

/**
 * Banner for a report persisted from the heuristic fallback, with an admin
 * action to re-run the AI examiner once the provider is available again.
 */
export function FallbackReportNotice({ sessionId }: { sessionId: string }) {
  const t = useTranslations("admin.reportDetail.fallback");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function regenerate() {
    // Replacement happens at most once and cannot be undone.
    if (!window.confirm(t("regenerateConfirm"))) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${sessionId}/regenerate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { code?: Code };
      if (res.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      if (res.status === 429) setError(t("errorRateLimited"));
      else if (data.code === "ai_unavailable") setError(t("errorAiUnavailable"));
      else if (data.code === "not_heuristic" || data.code === "concurrent_update") {
        setError(t("errorAlreadyUpdated"));
        router.refresh();
      } else setError(t("errorGeneric"));
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      role="status"
      className="clinical-card border-s-4 border-[var(--error)] p-5"
      data-testid="fallback-report-notice"
    >
      <h2 className="text-sm font-semibold text-[var(--on-surface)]">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
        {t("body")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={pending || done}
          aria-busy={pending}
          className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-60"
        >
          {pending ? t("regenerating") : t("regenerate")}
        </button>
        {done ? (
          <p className="text-sm text-[var(--primary)]">{t("success")}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
