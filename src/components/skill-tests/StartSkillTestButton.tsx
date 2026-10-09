"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Starts the next session of an assigned skill test. */
export function StartSkillTestButton({
  skillTestId,
  sessionNumber,
}: {
  skillTestId: string;
  sessionNumber: number;
}) {
  const router = useRouter();
  const t = useTranslations("skillTests.trainee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    // Each started session counts toward the test, even if abandoned.
    if (!window.confirm(t("startConfirm", { n: sessionNumber }))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillTestId }),
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
        className="btn-primary w-full"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          meeting_room
        </span>
        {loading ? t("starting") : t("startSession", { n: sessionNumber })}
      </button>
      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
