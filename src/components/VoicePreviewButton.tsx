"use client";

import { useRef, useState } from "react";
import type { SessionSpeechLocale } from "@/lib/voice/config";

/**
 * Admin voice preview — streams ElevenLabs audio when available,
 * falls back to a clear error (does not affect therapy text mode).
 */
export function VoicePreviewButton({
  locale,
  voiceId,
  voiceIdAr,
  voiceProfileId,
  avatarId,
  label,
}: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function preview() {
    setBusy(true);
    setError(null);
    setCached(false);
    try {
      audioRef.current?.pause();
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          stream: true,
          locale,
          voiceId: voiceId ?? undefined,
          voiceIdAr: voiceIdAr ?? undefined,
          voiceProfileId: voiceProfileId ?? undefined,
          avatarId: avatarId ?? undefined,
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
      setCached(res.headers.get("X-Voice-Cached") === "1");
      const blob = await new Response(res.body).blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
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
      {cached && !error && (
        <p className="text-[11px] text-[var(--on-surface-variant)]">
          Served from cache
        </p>
      )}
      {error && (
        <p className="text-[11px] text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
