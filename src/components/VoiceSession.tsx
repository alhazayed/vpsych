"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiAnalysisOverlay } from "@/components/AiAnalysisOverlay";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { SessionTimer } from "@/components/SessionTimer";
import { remainingSeconds } from "@/lib/session-timer";
import {
  sessionLocaleFrom,
  speakWithBrowser,
  synthesizeSpeech,
} from "@/lib/voice/client";
import { browserSpeechLocale } from "@/lib/voice/config";
import {
  startMicWavRecording,
  type MicRecorder,
} from "@/lib/voice/record-wav";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: {
      [index: number]: {
        [index: number]: { transcript: string };
        isFinal: boolean;
      };
      length: number;
    };
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function VoiceSession({
  session,
  avatar,
  initialMessages,
}: {
  session: TherapySession;
  avatar: Avatar;
  initialMessages: SessionMessage[];
}) {
  const router = useRouter();
  const locale = sessionLocaleFrom(session.language, avatar.language);
  const [messages, setMessages] = useState(initialMessages);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Ready — hold the mic or type a turn.");
  const [ending, setEnding] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micRecorderRef = useRef<MicRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const stopPlayback = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setStatus("Ending session and generating admin report…");
    try {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      micRecorderRef.current = null;
      stopPlayback();
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(
          data.error ?? "Failed to generate the session report. Try again.",
        );
        endingRef.current = false;
        setEnding(false);
        return;
      }
      router.push(`/sessions/${session.id}/complete`);
      router.refresh();
    } catch {
      setStatus("Failed to end session. Try again.");
      endingRef.current = false;
      setEnding(false);
    }
  }, [router, session.id, stopPlayback]);

  useEffect(() => {
    const tick = () => {
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      setRemaining(left);
      if (left <= 0 && !endingRef.current) {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endSession, session.max_duration_sec, session.started_at]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      stopPlayback();
    };
  }, [stopPlayback]);

  const speak = useCallback(
    async (text: string) => {
      stopPlayback();
      setSpeaking(true);
      const result = await synthesizeSpeech({
        text,
        locale,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
      });

      if (result.mode === "elevenlabs" && result.objectUrl) {
        const audio = new Audio(result.objectUrl);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(result.objectUrl!);
          setSpeaking(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          URL.revokeObjectURL(result.objectUrl!);
          setSpeaking(false);
          audioRef.current = null;
          speakWithBrowser(text, locale, {
            onstart: () => setSpeaking(true),
            onend: () => setSpeaking(false),
            onerror: () => setSpeaking(false),
          });
        };
        try {
          await audio.play();
        } catch {
          URL.revokeObjectURL(result.objectUrl);
          setSpeaking(false);
          speakWithBrowser(text, locale, {
            onstart: () => setSpeaking(true),
            onend: () => setSpeaking(false),
            onerror: () => setSpeaking(false),
          });
        }
        return;
      }

      speakWithBrowser(text, locale, {
        onstart: () => setSpeaking(true),
        onend: () => setSpeaking(false),
        onerror: () => setSpeaking(false),
      });
    },
    [avatar.voice_id, avatar.voice_id_ar, locale, stopPlayback],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || endingRef.current) return;
      setPending(true);
      setStatus("Patient is responding…");
      setDraft("");
      try {
        const res = await fetch(`/api/sessions/${session.id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.expired) {
            await endSession();
            return;
          }
          setStatus(data.error ?? "Failed to send message");
          return;
        }
        setMessages((prev) => [
          ...prev,
          data.userMessage as SessionMessage,
          data.assistantMessage as SessionMessage,
        ]);
        void speak((data.assistantMessage as SessionMessage).content);
        setStatus("Listening for your next turn.");
      } catch {
        setStatus("Network error — try again.");
      } finally {
        setPending(false);
      }
    },
    [endSession, pending, session.id, speak],
  );

  async function stopAzureListen() {
    const recorder = micRecorderRef.current;
    micRecorderRef.current = null;
    setListening(false);
    if (!recorder) return;

    setStatus("Transcribing…");
    try {
      const wav = await recorder.stop();
      const form = new FormData();
      form.append("audio", wav, "turn.wav");
      form.append("locale", locale);
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        transcript?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === "STT_UNAVAILABLE" || res.status === 501) {
          setStatus("Server STT unavailable — switching to browser mic…");
          startBrowserListen();
          return;
        }
        setStatus(data.error ?? "Transcription failed. Type your turn.");
        return;
      }

      const transcript = data.transcript?.trim() ?? "";
      if (!transcript) {
        setStatus("No speech detected — try again or type.");
        return;
      }
      setDraft(transcript);
      setStatus("Captured speech — sending…");
      void sendMessage(transcript);
    } catch {
      setStatus("Mic/transcription error — type your turn below.");
    }
  }

  function startBrowserListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("Speech recognition unavailable — type your turn below.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = browserSpeechLocale(locale);
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }
      if (finalText) {
        setDraft(finalText);
        setStatus("Captured speech — sending…");
        void sendMessage(finalText);
      } else if (interim) {
        setDraft(interim);
        setStatus("Listening…");
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      setStatus(`Mic error: ${event.error}. You can type instead.`);
    };
    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
    setStatus("Listening — speak now.");
  }

  async function toggleListen() {
    if (pending || ending) return;

    if (listening) {
      if (micRecorderRef.current) {
        await stopAzureListen();
        return;
      }
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    // Prefer Azure STT via recorded WAV; fall back to browser Web Speech.
    try {
      const recorder = await startMicWavRecording(12000);
      micRecorderRef.current = recorder;
      setListening(true);
      setStatus("Listening (Azure) — tap mic again to send.");
    } catch {
      startBrowserListen();
    }
  }

  const goals = avatar.ideal_guidelines?.session_goals ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {ending && <AiAnalysisOverlay />}
      <header className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:px-6">
        <Link href="/avatars" className="flex items-center gap-3">
          <Image
            src="/vpsych-logo.png"
            alt="VPsych"
            width={28}
            height={28}
            className="h-7 w-7 rounded object-cover"
          />
          <span className="font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight text-[var(--primary)]">
            VPsych
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)] sm:inline">
            {locale === "ar" ? "AR voice" : "EN voice"}
          </span>
          <SessionTimer remaining={remaining} />
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={ending}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            {ending ? "Ending…" : "End"}
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col pt-16 lg:flex-row">
        <section className="relative flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-6 lg:pb-12">
          <div className="absolute left-4 right-4 top-4 flex justify-between gap-3 pointer-events-none md:left-6 md:right-6">
            <div className="flex flex-col gap-2">
              <div className="pointer-events-auto rounded-xl border border-[var(--outline-variant)] bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  Patient
                </p>
                <p className="text-sm font-bold text-[var(--primary)]">
                  {avatar.name}
                </p>
              </div>
              <div className="pointer-events-auto rounded-xl border border-[var(--outline-variant)] bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  Presentation
                </p>
                <p className="text-sm font-bold text-[var(--secondary)]">
                  {avatar.disorder}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="pointer-events-auto h-fit rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 shadow-sm transition hover:bg-[var(--surface-container)]"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
                <span className="material-symbols-outlined text-[20px]">
                  description
                </span>
                Referral Notes
              </span>
            </button>
          </div>

          {showNotes && (
            <div className="absolute right-4 top-24 z-20 w-72 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-[var(--clinical-shadow-hover)] md:right-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                Ideal session goals
              </p>
              <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
                {goals.length ? (
                  goals.map((g) => <li key={g}>• {g}</li>)
                ) : (
                  <li>No referral notes for this persona.</li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-28 w-full max-w-md lg:mt-16">
            <AvatarPortrait
              name={avatar.name}
              src={avatar.portrait_url}
              speaking={speaking}
            />
          </div>

          <div className="mt-8 flex h-8 items-center justify-center gap-0.5">
            {[0.1, 0.3, 0.5, 0.2, 0.4, 0.15, 0.35].map((delay, i) => (
              <div
                key={i}
                className="audio-bar"
                style={{
                  animationDelay: `${delay}s`,
                  height: listening || speaking ? undefined : "4px",
                  animationPlayState:
                    listening || speaking ? "running" : "paused",
                }}
              />
            ))}
          </div>

          <p className="mt-4 max-w-md text-center text-sm text-[var(--on-surface-variant)]">
            {status}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void toggleListen()}
              disabled={pending || ending}
              className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition ${
                listening
                  ? "mic-pulse bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
                  : "bg-[var(--primary)] text-[var(--on-primary)]"
              } disabled:opacity-50`}
              aria-label={listening ? "Stop microphone" : "Start microphone"}
            >
              <span className="material-symbols-outlined text-[28px]">
                {listening ? "stop" : "mic"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void endSession()}
              disabled={ending}
              className="btn-secondary"
            >
              {ending ? "Ending…" : "End session"}
            </button>
          </div>
        </section>

        <section className="flex min-h-[22rem] flex-col border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] lg:w-[26rem] lg:border-l lg:border-t-0 xl:w-[30rem]">
          <div className="border-b border-[var(--outline-variant)] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              Transcript
            </h2>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages
              .filter((m) => m.role !== "system")
              .map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-[var(--primary-fixed)] text-[var(--on-surface)]"
                      : "bg-[var(--surface-container)] text-[var(--on-surface)]"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    {m.role === "user" ? "You" : avatar.name}
                  </p>
                  {m.content}
                </div>
              ))}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-[var(--outline-variant)] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a turn if mic is unavailable…"
              className="field-input flex-1"
              disabled={pending || ending}
            />
            <button
              type="submit"
              disabled={pending || ending || !draft.trim()}
              className="btn-primary px-4"
            >
              Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
