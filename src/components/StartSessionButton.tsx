"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppLocale } from "@/i18n/config";
import { LOCALE_COOKIE } from "@/i18n/config";
import { primeTherapyRoomMicrophone } from "@/lib/therapy-room";

function cookieLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function therapyRoomFlagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_THERAPY_ROOM_MODE === "true";
}

export function StartSessionButton({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("session.start");
  const tRoom = useTranslations("therapyRoom.start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomEnabled = therapyRoomFlagEnabled();
  const [mode, setMode] = useState<"classic" | "therapy_room">("classic");

  async function start() {
    setLoading(true);
    setError(null);
    try {
      // Hands-free requires getUserMedia under this click (user gesture).
      // Without priming, the session page's deferred getUserMedia fails on
      // Safari / some Chromium builds with NotAllowedError → ERROR + Retry.
      if (roomEnabled && mode === "therapy_room") {
        try {
          await primeTherapyRoomMicrophone();
        } catch (err) {
          console.error("[therapy-room] mic prime failed", err);
          setError(tRoom("micRequired"));
          setLoading(false);
          return;
        }
      }

      const sessionLocale = locale || cookieLocale();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          locale: sessionLocale,
          interactionMode: roomEnabled ? mode : "classic",
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
      {roomEnabled && (
        <div
          className="flex rounded-lg border border-[var(--outline-variant)] p-0.5 text-xs"
          role="group"
          aria-label={tRoom("modeLabel")}
        >
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              mode === "classic"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--on-surface-variant)]"
            }`}
            onClick={() => setMode("classic")}
            disabled={loading}
          >
            {tRoom("classic")}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              mode === "therapy_room"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--on-surface-variant)]"
            }`}
            onClick={() => setMode("therapy_room")}
            disabled={loading}
          >
            {tRoom("therapyRoom")}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => void start()}
        disabled={loading}
        className="btn-primary w-full"
      >
        <span className="material-symbols-outlined text-[20px]">
          {mode === "therapy_room" ? "meeting_room" : "mic"}
        </span>
        {loading
          ? t("starting")
          : mode === "therapy_room"
            ? tRoom("cta")
            : t("cta")}
      </button>
      {roomEnabled && mode === "therapy_room" && (
        <p className="text-xs text-[var(--on-surface-variant)]">
          {tRoom("hint")}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
