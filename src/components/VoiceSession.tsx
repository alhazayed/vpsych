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
import { ConversationToolbar } from "@/components/conversation/ConversationToolbar";
import {
  HandsFreeSettingsPanel,
  useVoicePreferences,
} from "@/components/conversation/HandsFreeSettingsPanel";
import { MicWaveform } from "@/components/conversation/MicWaveform";
import { SessionStatusBar } from "@/components/conversation/SessionStatusBar";
import { useHandsFreeController } from "@/components/conversation/useHandsFreeController";
import { remainingSeconds } from "@/lib/session-timer";
import { mergeVoicePreferences, saveLocalVoicePreferences } from "@/lib/conversation";
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
  handsFreeEnabled = false,
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
  /** Server-resolved ENABLE_HANDS_FREE_THERAPY flag. */
  handsFreeEnabled?: boolean;
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
  const [showHfteSettings, setShowHfteSettings] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [prefs, setPrefs] = useVoicePreferences(handsFreeEnabled);
  const handsFreeActive =
    handsFreeEnabled && prefs.mode === "hands_free" && voiceEnabled;
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

  const hfte = useHandsFreeController({
    enabled: handsFreeActive,
    session,
    avatar,
    preferences: prefs,
    onPreferencesPatch: (patch) => {
      setPrefs((p) => {
        const next = mergeVoicePreferences(p, patch);
        saveLocalVoicePreferences(next);
        return next;
      });
    },
    onMessages: (userMessage, assistantMessage) => {
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    },
    onStatusText: setStatus,
    onEndSession: () => {
      void endSession();
    },
    onConfirmEnd: () => setEndConfirm(true),
    ending,
  });

  const portraitSpeaking =
    handsFreeActive
      ? hfte.conversationState === "AvatarSpeaking"
      : speaking;

  useEffect(() => {
    const tick = () => {
      if (
        handsFreeActive &&
        prefs.freezeTimerWhenPaused &&
        hfte.paused
      ) {
        return;
      }
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      // Optional: subtract accumulated pause — controller tracks pausedAccumMs
      setRemaining(left);
      if (left <= 0 && !endingRef.current) {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [
    endSession,
    handsFreeActive,
    hfte.paused,
    prefs.freezeTimerWhenPaused,
    session.max_duration_sec,
    session.started_at,
  ]);

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
        speechPace: avatar.personality?.speech?.pace ?? null,
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
      avatar.personality?.speech?.pace,
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
        speechPace: avatar.personality?.speech?.pace ?? null,
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

  const goals = avatar.ideal_guidelines?.session_goals ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {ending && <AiAnalysisOverlay />}
      {handsFreeActive && (
        <SessionStatusBar
          status={hfte.statusKind}
          label={t(`hfte.status.${hfte.statusKind}`)}
        />
      )}
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
          {handsFreeEnabled && (
            <button
              type="button"
              onClick={() => setShowHfteSettings((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface-variant)]"
              title={t("hfte.settingsTitle")}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              {t("hfte.settings")}
            </button>
          )}
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

      {handsFreeEnabled && (
        <HandsFreeSettingsPanel
          open={showHfteSettings}
          onClose={() => setShowHfteSettings(false)}
          value={prefs}
          onChange={setPrefs}
          labels={{
            title: t("hfte.settingsTitle"),
            mode: t("hfte.mode"),
            handsFree: t("hfte.handsFree"),
            pushToTalk: t("hfte.pushToTalk"),
            autoInterrupt: t("hfte.autoInterrupt"),
            thinkingDelay: t("hfte.thinkingDelay"),
            waveform: t("hfte.waveform"),
            sensitivity: t("hfte.sensitivity"),
            close: t("hfte.close"),
          }}
        />
      )}

      {endConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 shadow-lg">
            <p className="text-sm font-semibold text-[var(--on-surface)]">
              {t("hfte.endConfirm")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEndConfirm(false)}
              >
                {t("hfte.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEndConfirm(false);
                  void endSession();
                }}
              >
                {t("endSession")}
              </button>
            </div>
          </div>
        </div>
      )}

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

          {hfte.showPrivateNotes && (
            <div className="absolute start-4 top-24 z-20 w-72 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-[var(--clinical-shadow-hover)] md:start-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                {t("hfte.privateNotes")}
              </p>
              <p className="mb-2 text-[10px] text-[var(--on-surface-variant)]">
                {t("hfte.privateNotesHint")}
              </p>
              <textarea
                value={hfte.privateNotes}
                onChange={(e) => hfte.setPrivateNotes(e.target.value)}
                className="field-input min-h-28 w-full text-sm"
                placeholder={t("hfte.privateNotesPlaceholder")}
              />
            </div>
          )}

          <div className="mt-28 w-full max-w-md lg:mt-16">
            <AvatarPortrait
              name={avatar.name}
              src={avatar.portrait_url}
              speaking={portraitSpeaking}
            />
          </div>

          {handsFreeActive ? (
            <MicWaveform
              samples={hfte.waveSamples}
              visible={prefs.showWaveform}
            />
          ) : (
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
          )}

          <p className="mt-4 max-w-md text-center text-sm text-[var(--on-surface-variant)]">
            {status}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--outline)]">
            {locale === "ar" ? "العربية" : "English"}
            {" · "}
            {handsFreeActive
              ? t("hfte.pipelineHandsFree")
              : voiceEnabled
                ? t("pipelineVoice")
                : t("pipelineText")}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pb-16">
            {voiceEnabled && !handsFreeActive && (
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
            {!handsFreeActive && (
              <button
                type="button"
                onClick={() => void endSession()}
                disabled={ending}
                className="btn-secondary"
              >
                {ending ? t("ending") : t("endSession")}
              </button>
            )}
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
              disabled={pending || ending || hfte.paused}
            />
            <button
              type="submit"
              disabled={pending || ending || !draft.trim() || hfte.paused}
              className="btn-primary px-4"
            >
              {t("send")}
            </button>
          </form>
        </section>
      </main>

      {handsFreeActive && (
        <ConversationToolbar
          paused={hfte.paused}
          avatarMuted={hfte.avatarMuted}
          onPause={hfte.pause}
          onResume={hfte.resume}
          onMuteAvatar={hfte.toggleAvatarMute}
          onRepeat={hfte.repeatLastAnswer}
          onToggleNotes={() => hfte.setShowPrivateNotes((v) => !v)}
          onEnd={() => setEndConfirm(true)}
          disabled={ending}
          labels={{
            pause: t("hfte.pause"),
            resume: t("hfte.resume"),
            mute: t("hfte.muteAvatar"),
            unmute: t("hfte.unmuteAvatar"),
            repeat: t("hfte.repeat"),
            notes: t("hfte.privateNotes"),
            end: t("endSession"),
          }}
        />
      )}
    </div>
  );
}
