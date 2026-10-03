"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Admin action for a finished learner session that never got a report
 * (tab closed, expiry cron, failed end request).
 */
export function GenerateReportButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations("admin.sessions.generateReport");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${sessionId}/generate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string };
      if (res.ok || data.code === "report_exists") {
        router.refresh();
        return;
      }
      if (res.status === 429) setError(t("errorRateLimited"));
      else if (data.code === "misconfigured") setError(t("errorMisconfigured"));
      else if (data.code === "no_therapist_turns") setError(t("errorEmpty"));
      else setError(t("errorGeneric"));
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={pending}
        aria-busy={pending}
        className="btn-primary"
      >
        {pending ? t("generating") : t("cta")}
      </button>
      {error ? (
        <span role="alert" className="max-w-xs text-xs text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
