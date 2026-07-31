"use client";

import { useState } from "react";
import type { SessionSpeechLocale } from "@/lib/voice/config";

export function VoicePreviewButton({
  locale,
  voiceId,
  voiceIdAr,
  label,
}: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          locale,
          voiceId: voiceId ?? undefined,
          voiceIdAr: voiceIdAr ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        setError(
          data.code === "TTS_UNAVAILABLE"
            ? "ElevenLabs not configured"
            : data.error ?? "Preview failed",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Could not play audio");
      };
      await audio.play();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void preview()}
        disabled={busy}
        className="btn-secondary h-9 px-3 text-xs"
      >
        <span className="material-symbols-outlined text-[18px]">
          {busy ? "hourglass_top" : "play_arrow"}
        </span>
        {busy ? "Playing…" : label}
      </button>
      {error && (
        <p className="text-[11px] text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
