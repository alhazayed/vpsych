"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Ensures a completed/expired session gets an admin report even when the
 * therapist never POSTed /end (e.g. idle expiry on the sessions list).
 * Idempotent — /end returns alreadyExists when a report is present.
 */
export function EnsureSessionReport({ sessionId }: { sessionId: string }) {
  const t = useTranslations("sessions.complete");
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "error">(
    "idle",
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      setStatus("working");
      try {
        const res = await fetch(`/api/sessions/${sessionId}/end`, {
          method: "POST",
        });
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "idle" || status === "ok") return null;

  return (
    <p
      className="mb-4 text-center text-sm text-[var(--on-surface-variant)]"
      role="status"
      aria-live="polite"
    >
      {status === "working" ? t("ensuringReport") : t("ensureReportFailed")}
    </p>
  );
}
