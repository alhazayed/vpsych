"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Starts a ladder level. The server decides the case and refuses a locked
 * level; the button sends only which patient and level to play.
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
  const t = useTranslations("training");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ladderPatientKey: patientKey, ladderLevel: level }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sessionId?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionId) {
        setError(data.error ?? t("startFailed"));
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
