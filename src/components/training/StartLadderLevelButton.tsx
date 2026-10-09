"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sessionStartErrorKey } from "@/lib/session-start-error";

/**
 * Starts a ladder level. The server decides the case and refuses a locked
 * level; the button sends which patient and level to play, plus the UI
 * language so a trainee browsing in Arabic meets the Arabic patient.
 */
export function StartLadderLevelButton({
  patientKey,
  level,
  label,
  variant = "primary",
}: {
  patientKey: string;
  level: number;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("training");
  const tStart = useTranslations("session.start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ladderPatientKey: patientKey,
          ladderLevel: level,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sessionId?: string;
        code?: string;
      };
      if (!res.ok || !data.sessionId) {
        setError(
          res.ok
            ? t("startFailed")
            : tStart(sessionStartErrorKey(res.status, data.code)),
        );
        setLoading(false);
        return;
      }
      router.push(`/sessions/${data.sessionId}`);
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={loading}
        aria-busy={loading}
        className={variant === "primary" ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          meeting_room
        </span>
        {loading ? t("starting") : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
