"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AiAnalysisOverlay } from "@/components/AiAnalysisOverlay";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SessionTimer } from "@/components/SessionTimer";
import { remainingSeconds } from "@/lib/session-timer";
import {
  playPatientSpeech,
  resolvePipelineLocale,
  runVoiceConversationTurn,
  submitConversationTurn,
} from "@/lib/voice/conversation-pipeline";
import {
  startMicWavRecording,
  type MicRecorder,
} from "@/lib/voice/record-wav";
import type {
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";
import { shouldHideGroundTruth } from "@/lib/exam-disclosure";

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

function formatMessageTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Multilingual conversation UI.
 *
 * Voice pipeline (optional):
 *   Therapist Speech → OpenAI STT → GPT-5 Patient → ElevenLabs → Browser Audio
 *
 * Text-only mode uses the same message API (persist + GPT-5) without mic/TTS.
 */
export function VoiceSession({
  session,
  avatar,
  initialMessages,
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
}) {
  const router = useRouter();
  const t = useTranslations("session");
  const locale = resolvePipelineLocale(session.language, avatar.language);
  const [messages, setMessages] = useState(initialMessages);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(() => t("status.ready"));
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
    setStatus(t("status.ending"));
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
      setStatus(t("status.endFailed"));
      endingRef.current = false;
      setEnding(false);
    }
  }, [router, session.id, t, stopPlayback]);

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
      if (!voiceEnabled) return;
      stopPlayback();
      setSpeaking(true);
      await playPatientSpeech({
        text,
        locale,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        audioRef,
        handlers: {
          onstart: () => setSpeaking(true),
          onend: () => setSpeaking(false),
          onerror: () => setSpeaking(false),
        },
      });
    },
    [
      avatar.id,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      locale,
      stopPlayback,
      voiceEnabled,
    ],
  );

  /** Text or post-STT turn — always persists messages + timestamps server-side. */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || endingRef.current) return;
      setPending(true);
      setStatus(t("status.patientResponding"));
      setDraft("");
      try {
        const turn = await submitConversationTurn({
          sessionId: session.id,
          message: trimmed,
        });
        if (!turn.ok) {
          if (turn.expired) {
            await endSession();
            return;
          }
          setStatus(turn.error || t("status.sendFailed"));
          return;
        }
        setMessages((prev) => [
          ...prev,
          turn.data.userMessage,
          turn.data.assistantMessage,
        ]);
        if (voiceEnabled) {
          void speak(turn.data.assistantMessage.content);
        }
        setStatus(
          voiceEnabled ? t("status.listeningNext") : t("status.textReady"),
        );
      } catch {
        setStatus(t("status.networkError"));
      } finally {
        setPending(false);
      }
    },
    [endSession, pending, session.id, speak, t, voiceEnabled],
  );

  async function stopOpenAIListen() {
    const recorder = micRecorderRef.current;
    micRecorderRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    if (!recorder) return;

    setStatus(t("status.transcribing"));
    setPending(true);

    try {
      const wav = await recorder.stop();
      const result = await runVoiceConversationTurn({
        sessionId: session.id,
        audio: wav,
        sessionLanguage: session.language ?? locale,
        locale,
        voiceEnabled,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        audioRef,
        onTranscript: (transcript) => setDraft(transcript),
        onMessages: (userMessage, assistantMessage) => {
          setMessages((prev) => [...prev, userMessage, assistantMessage]);
        },
        speakHandlers: {
          onstart: () => setSpeaking(true),
          onend: () => setSpeaking(false),
          onerror: () => setSpeaking(false),
        },
      });

      if (!result.ok) {
        if (result.stage === "stt" && result.unavailable) {
          setStatus(t("status.sttUnavailable"));
          startBrowserListen({ autoSend: true });
          return;
        }
        if (result.expired) {
          await endSession();
          return;
        }
        if (result.stage === "stt" && result.error === "No speech detected") {
          setStatus(t("status.noSpeech"));
          return;
        }
        setStatus(result.error || t("status.transcribeFailed"));
        return;
      }

      setDraft("");
      setStatus(
        voiceEnabled ? t("status.listeningNext") : t("status.textReady"),
      );
    } catch {
      setStatus(t("status.micTranscribeError"));
    } finally {
      setPending(false);
    }
  }

  function startBrowserListen(options?: {
    autoSend?: boolean;
    interimOnly?: boolean;
  }) {
    const autoSend = options?.autoSend ?? true;
    const interimOnly = options?.interimOnly ?? false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (!interimOnly) setStatus(t("status.speechUnavailable"));
      return;
    }

    const recognition = new SR();
    recognition.continuous = interimOnly;
    recognition.interimResults = true;
    recognition.lang =
      avatar.stt_lang || (locale === "ar" ? "ar-SA" : "en-US");
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
      const live = (finalText || interim).trim();
      if (live) {
        setDraft(live);
        setStatus(t("status.listening"));
      }
      if (finalText && autoSend && !interimOnly) {
        setDraft(finalText);
        setStatus(t("status.captured"));
        void sendMessage(finalText);
      }
    };
    recognition.onerror = (event) => {
      if (interimOnly) return;
      setListening(false);
      setStatus(t("status.micError", { error: event.error }));
    };
    recognition.onend = () => {
      if (!interimOnly) setListening(false);
    };

    try {
      recognition.start();
      if (!interimOnly) {
        setListening(true);
        setStatus(t("status.speakNow"));
      }
    } catch {
      if (!interimOnly) setStatus(t("status.speechUnavailable"));
    }
  }

  async function toggleListen() {
    if (pending || ending || !voiceEnabled) return;

    if (listening) {
      if (micRecorderRef.current) {
        await stopOpenAIListen();
        return;
      }
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    try {
      const recorder = await startMicWavRecording(20000);
      micRecorderRef.current = recorder;
      setListening(true);
      setDraft("");
      setStatus(
        t("status.listeningOpenAI", {
          language: locale === "ar" ? "العربية" : "English",
        }),
      );
      startBrowserListen({ autoSend: false, interimOnly: true });
    } catch {
      startBrowserListen({ autoSend: true });
    }
  }

  function toggleVoiceMode() {
    if (listening) {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      micRecorderRef.current = null;
      setListening(false);
    }
    stopPlayback();
    setSpeaking(false);
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    setStatus(next ? t("status.ready") : t("status.textOnly"));
  }

  const hideGroundTruth = shouldHideGroundTruth(session.clinical_snapshot);
  const goals = hideGroundTruth
    ? []
    : (avatar.ideal_guidelines?.session_goals ?? []);
  const presentationLabel = hideGroundTruth
    ? t("undisclosedPresentation")
    : avatar.disorder;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {ending && <AiAnalysisOverlay />}
      <header className="fixed start-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:px-6">
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
        <div className="flex items-center gap-2 md:gap-3">
          <SessionTimer remaining={remaining} />
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={toggleVoiceMode}
            disabled={pending || ending}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              voiceEnabled
                ? "bg-[var(--primary-fixed)] text-[var(--on-surface)]"
                : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
            }`}
            aria-pressed={voiceEnabled}
            title={voiceEnabled ? t("voiceOn") : t("voiceOff")}
          >
            <span className="material-symbols-outlined text-[18px]">
              {voiceEnabled ? "graphic_eq" : "keyboard"}
            </span>
            {voiceEnabled ? t("voiceMode") : t("textMode")}
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={ending}
            className="btn-secondary h-9 px-3 text-xs"
          >
            {ending ? t("ending") : t("end")}
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col pt-16 lg:flex-row">
        <section className="relative flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-6 lg:pb-12">
          <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between gap-3 md:inset-x-6">
            <div className="flex flex-col gap-2">
              <div className="pointer-events-auto rounded-xl border border-[var(--outline-variant)] bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {t("patient")}
                </p>
                <p className="text-sm font-bold text-[var(--primary)]">
                  {avatar.name}
                </p>
              </div>
              <div className="pointer-events-auto rounded-xl border border-[var(--outline-variant)] bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {t("presentation")}
                </p>
                <p className="text-sm font-bold text-[var(--secondary)]">
                  {presentationLabel}
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
                {t("referralNotes")}
              </span>
            </button>
          </div>

          {showNotes && (
            <div className="absolute end-4 top-24 z-20 w-72 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-[var(--clinical-shadow-hover)] md:end-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                {t("idealGoals")}
              </p>
              <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
                {goals.length ? (
                  goals.map((g) => <li key={g}>• {g}</li>)
                ) : (
                  <li>{t("noReferralNotes")}</li>
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
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--outline)]">
            {locale === "ar" ? "العربية" : "English"}
            {" · "}
            {voiceEnabled ? t("pipelineVoice") : t("pipelineText")}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {voiceEnabled && (
              <button
                type="button"
                onClick={() => void toggleListen()}
                disabled={pending || ending}
                className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition ${
                  listening
                    ? "mic-pulse bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
                    : "bg-[var(--primary)] text-[var(--on-primary)]"
                } disabled:opacity-50`}
                aria-label={listening ? t("stopMic") : t("startMic")}
              >
                <span className="material-symbols-outlined text-[28px]">
                  {listening ? "stop" : "mic"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void endSession()}
              disabled={ending}
              className="btn-secondary"
            >
              {ending ? t("ending") : t("endSession")}
            </button>
          </div>
        </section>

        <section className="flex min-h-[22rem] flex-col border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] lg:w-[26rem] lg:border-s lg:border-t-0 xl:w-[30rem]">
          <div className="border-b border-[var(--outline-variant)] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("transcript")}
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
                      ? "ms-auto bg-[var(--primary-fixed)] text-[var(--on-surface)]"
                      : "bg-[var(--surface-container)] text-[var(--on-surface)]"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                      {m.role === "user" ? t("you") : avatar.name}
                    </p>
                    {m.created_at && (
                      <time
                        dateTime={m.created_at}
                        className="text-[10px] tabular-nums text-[var(--outline)]"
                      >
                        {formatMessageTime(m.created_at)}
                      </time>
                    )}
                  </div>
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
              placeholder={
                voiceEnabled ? t("inputPlaceholder") : t("inputPlaceholderText")
              }
              className="field-input flex-1"
              disabled={pending || ending}
            />
            <button
              type="submit"
              disabled={pending || ending || !draft.trim()}
              className="btn-primary px-4"
            >
              {t("send")}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

