"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

function cookieLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}


export function StartSessionButton({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const t = useTranslations("session.start");
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
          avatarId,
          locale: cookieLocale(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("failed"));
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
        className="btn-primary w-full"
      >
        <span className="material-symbols-outlined text-[20px]">mic</span>
        {loading ? t("starting") : t("cta")}
      </button>
      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
