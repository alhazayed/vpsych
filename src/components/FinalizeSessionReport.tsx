"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type State = "pending" | "done" | "error";

/**
 * Self-heals a finished session that has no report yet — the tab was closed
 * mid-session, the session was expired by the maintenance cron, or the end
 * request failed. Re-uses the idempotent POST /api/sessions/[id]/end, which
 * skips status changes for non-active sessions and is insert-once on reports.
 */
export function FinalizeSessionReport({
  sessionId,
  refreshOnDone = false,
}: {
  sessionId: string;
  /** Re-render the server page after success (e.g. to show coach feedback). */
  refreshOnDone?: boolean;
}) {
  const t = useTranslations("sessions.complete.finalize");
  const router = useRouter();
  const [state, setState] = useState<State>("pending");
  const started = useRef(false);

  const run = useCallback(async () => {
    setState("pending");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: "POST",
      });
      setState(res.ok ? "done" : "error");
      if (res.ok && refreshOnDone) router.refresh();
    } catch {
      setState("error");
    }
  }, [refreshOnDone, router, sessionId]);

  useEffect(() => {
    // Ref guard: React Strict Mode re-runs effects in development.
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="finalize-session-report"
      data-state={state}
      className="clinical-card mb-4 flex flex-wrap items-center gap-3 p-4 text-sm"
    >
      <span
        aria-hidden
        className={`material-symbols-outlined text-[20px] ${
          state === "error" ? "text-[var(--error)]" : "text-[var(--primary)]"
        } ${state === "pending" ? "animate-spin" : ""}`}
      >
        {state === "pending" ? "progress_activity" : state === "done" ? "task_alt" : "error"}
      </span>
      <span className="flex-1 text-[var(--on-surface)]">{t(state)}</span>
      {state === "error" ? (
        <button
          type="button"
          onClick={() => void run()}
          className="btn-secondary min-h-11 px-4"
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
