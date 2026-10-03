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
import { AdminTestBanner } from "@/components/admin/AdminTestBanner";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { remainingSeconds } from "@/lib/session-timer";
import {
  playPatientSpeech,
  resolvePipelineLocale,
  runVoiceConversationTurn,
  submitConversationTurn,
  transcribeTherapistSpeech,
  type PipelineTurnResult,
} from "@/lib/voice/conversation-pipeline";
// Direct module imports (not the `@/lib/realtime` barrel) keep this client
// bundle to the modules it uses; the barrel also carries the realtime engine
// and the session-end bridge.
import { submitStreamingConversationTurn } from "@/lib/realtime/client-pipeline";
import {
  browserSpeechChunkDeps,
  createProgressiveSpeechQueue,
  type ProgressiveSpeechQueue,
} from "@/lib/realtime/progressive-tts";
import { createTurnFence, type TurnTicket } from "@/lib/realtime/turn-fence";
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
 * Realtime mode (`realtimeStreaming`, server feature flag; off by default):
 *   STT → /message/stream (shared clinical pipeline, true token streaming)
 *   → sentence events → bounded progressive ElevenLabs TTS → ordered playback.
 *   Therapist speech (mic press) or a typed message barges in: TTS and the
 *   SSE/LLM generation abort, the turn fence advances, pending audio clears.
 *   Classic /message stays the fallback.
 *
 * Text-only mode uses the same message API (persist + GPT-5) without mic/TTS.
 */
export function VoiceSession({
  session,
  avatar,
  initialMessages,
  realtimeStreaming = false,
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
  /** Server-resolved `isRealtimeStreamingEnabled()`; classic when false. */
  realtimeStreaming?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("session");
  const adminTest = isAdminTestSnapshot(session.clinical_snapshot);
  const locale = resolvePipelineLocale(session.language, avatar.language);
  const disorderSlug =
    session.clinical_snapshot?.primary_diagnosis?.slug ?? null;
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
  // Realtime turn state — every async effect is fenced by turn generation.
  const [fence] = useState(createTurnFence);
  const speechQueueRef = useRef<ProgressiveSpeechQueue | null>(null);
  const patientActiveRef = useRef(false);
  const bargeInRef = useRef(false);
  const voiceEnabledRef = useRef(voiceEnabled);
  const [liveReply, setLiveReply] = useState("");

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const stopPlayback = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  /**
   * Barge-in / cancel for the realtime path, in order:
   * abort active TTS → abort SSE + LLM generation → advance the turn fence →
   * clear pending audio. Returns true when the patient was generating or
   * speaking (the next turn then carries `therapistInterrupted`).
   */
  const interruptPatient = useCallback(() => {
    const wasActive = patientActiveRef.current;
    speechQueueRef.current?.abort();
    speechQueueRef.current = null;
    fence.invalidate();
    stopPlayback();
    patientActiveRef.current = false;
    setLiveReply("");
    setSpeaking(false);
    return wasActive;
  }, [fence, stopPlayback]);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setStatus(t("status.ending"));
    try {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      micRecorderRef.current = null;
      interruptPatient();
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(
          data.error ?? t("status.endFailed"),
        );
        endingRef.current = false;
        setEnding(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        adminTest?: boolean;
        skippedAssessment?: boolean;
      };
      if (data.adminTest && data.skippedAssessment) {
        router.push(`/admin/avatars/${session.avatar_id}`);
      } else {
        router.push(`/sessions/${session.id}/complete`);
      }
      router.refresh();
    } catch {
      setStatus(t("status.endFailed"));
      endingRef.current = false;
      setEnding(false);
    }
  }, [router, session.avatar_id, session.id, t, interruptPatient]);

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
  }, [messages, status, liveReply]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      interruptPatient();
    };
  }, [interruptPatient]);

  const speak = useCallback(
    async (
      text: string,
      voiceHints?: {
        pause_before_ms?: number;
        speech_rate?: number;
        stability?: number;
        style?: number;
        speech_pace?: string;
        speech_energy?: string;
      } | null,
    ) => {
      if (!voiceEnabled) return;
      stopPlayback();
      setSpeaking(true);
      const mode = await playPatientSpeech({
        text,
        locale,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        speechPace:
          voiceHints?.speech_pace ?? avatar.personality?.speech?.pace ?? null,
        speechEnergy: voiceHints?.speech_energy ?? null,
        disorderSlug,
        stability: voiceHints?.stability ?? null,
        style: voiceHints?.style ?? null,
        pauseBeforeMs: voiceHints?.pause_before_ms ?? null,
        audioRef,
        handlers: {
          onstart: () => setSpeaking(true),
          onend: () => setSpeaking(false),
          onerror: () => setSpeaking(false),
        },
      });
      if (mode === "browser") {
        setStatus(t("status.ttsBrowserFallback"));
      }
    },
    [
      avatar.id,
      avatar.personality?.speech?.pace,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      disorderSlug,
      locale,
      stopPlayback,
      t,
      voiceEnabled,
    ],
  );

  /** Text or post-STT turn — always persists messages + timestamps server-side. */
  const sendClassicMessage = useCallback(
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
          void speak(turn.data.assistantMessage.content, turn.data.voiceHints);
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

  /** One progressive TTS queue per draft attempt, fenced to the turn ticket. */
  const createSpeechQueue = useCallback(
    (ticket: TurnTicket, hints: PipelineTurnResult["voiceHints"]) => {
      if (!voiceEnabledRef.current) return null;
      return createProgressiveSpeechQueue(
        browserSpeechChunkDeps({
          locale,
          voiceId: avatar.voice_id,
          voiceIdAr: avatar.voice_id_ar,
          voiceProfileId: avatar.voice_profile_id,
          avatarId: avatar.id,
          speechPace:
            hints?.speech_pace ?? avatar.personality?.speech?.pace ?? null,
          speechEnergy: hints?.speech_energy ?? null,
          disorderSlug,
          stability: hints?.stability ?? null,
          style: hints?.style ?? null,
          audioRef,
          isCurrent: ticket.isCurrent,
        }),
        {
          pauseBeforeMs: hints?.pause_before_ms ?? 0,
          onPlaybackStart: () => {
            if (ticket.isCurrent()) setSpeaking(true);
          },
          onSettled: (outcome) => {
            if (!ticket.isCurrent()) return;
            setSpeaking(false);
            if (outcome === "completed") patientActiveRef.current = false;
          },
        },
      );
    },
    [
      avatar.id,
      avatar.personality?.speech?.pace,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      disorderSlug,
      locale,
    ],
  );

  /**
   * Realtime turn: SSE token stream → sentence events → progressive TTS.
   * A new turn (or barge-in) aborts the previous one first; every callback
   * checks the turn ticket so stale tokens, TTS results, playback callbacks
   * and completions are discarded.
   */
  const sendRealtimeTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || endingRef.current) return;
      const therapistInterrupted = interruptPatient() || bargeInRef.current;
      bargeInRef.current = false;
      const ticket = fence.begin();
      patientActiveRef.current = true;
      setLiveReply("");
      setDraft("");
      setStatus(t("status.patientResponding"));

      // Holder (not a `let`) so callbacks can set it without TS narrowing to null.
      const turnHints: { current: PipelineTurnResult["voiceHints"] } = {
        current: null,
      };
      let sentences = 0;
      const resetSpeech = () => {
        speechQueueRef.current?.abort();
        speechQueueRef.current = ticket.isCurrent()
          ? createSpeechQueue(ticket, turnHints.current)
          : null;
      };

      const result = await submitStreamingConversationTurn({
        sessionId: session.id,
        message: trimmed,
        therapistInterrupted,
        clientTurnId: `t${ticket.generation}`,
        isCurrent: ticket.isCurrent,
        handlers: {
          signal: ticket.signal,
          onStarted: (info) => {
            turnHints.current = info.voiceHints ?? null;
            setMessages((prev) => [...prev, info.userMessage]);
            resetSpeech();
          },
          onToken: (_token, partial) => setLiveReply(partial),
          onSentence: (sentence) => {
            sentences += 1;
            speechQueueRef.current?.enqueue(sentence.text);
          },
          onRegenerating: () => {
            // Draft discarded server-side: drop its text and its audio.
            setLiveReply("");
            setSpeaking(false);
            sentences = 0;
            resetSpeech();
          },
        },
      });

      if (!ticket.isCurrent() || result.status === "stale") return;
      setLiveReply("");

      if (result.status === "completed") {
        const assistant = result.data.assistantMessage;
        setMessages((prev) => [...prev, assistant]);
        const queue = speechQueueRef.current;
        if (queue && sentences > 0) {
          queue.close();
        } else if (voiceEnabledRef.current && assistant.content.trim()) {
          // Classic full-response TTS fallback (no sentence events reached us).
          queue?.abort();
          speechQueueRef.current = null;
          void playPatientSpeech({
            text: assistant.content,
            locale,
            voiceId: avatar.voice_id,
            voiceIdAr: avatar.voice_id_ar,
            voiceProfileId: avatar.voice_profile_id,
            avatarId: avatar.id,
            speechPace:
              turnHints.current?.speech_pace ??
              avatar.personality?.speech?.pace ??
              null,
            speechEnergy: turnHints.current?.speech_energy ?? null,
            disorderSlug,
            stability: turnHints.current?.stability ?? null,
            style: turnHints.current?.style ?? null,
            audioRef,
            signal: ticket.signal,
            handlers: {
              onstart: () => ticket.isCurrent() && setSpeaking(true),
              onend: () => {
                if (!ticket.isCurrent()) return;
                setSpeaking(false);
                patientActiveRef.current = false;
              },
              onerror: () => ticket.isCurrent() && setSpeaking(false),
            },
          });
        } else {
          patientActiveRef.current = false;
        }
        setStatus(
          voiceEnabledRef.current
            ? t("status.listeningNext")
            : t("status.textReady"),
        );
        return;
      }

      speechQueueRef.current?.abort();
      speechQueueRef.current = null;
      patientActiveRef.current = false;
      setSpeaking(false);

      if (result.status === "interrupted") {
        setStatus(t("status.ready"));
        return;
      }

      // failed
      if (result.expired) {
        await endSession();
        return;
      }
      if (!result.fallbackToClassic) {
        setStatus(
          result.error === "network_error" ||
            result.error === "stream_disconnected" ||
            result.error === "stream_incomplete"
            ? t("status.networkError")
            : t("status.sendFailed"),
        );
        return;
      }

      // Stream route refused before persisting anything → classic /message.
      patientActiveRef.current = true;
      try {
        const turn = await submitConversationTurn({
          sessionId: session.id,
          message: trimmed,
          therapistInterrupted,
          signal: ticket.signal,
        });
        if (!ticket.isCurrent()) return;
        if (!turn.ok) {
          patientActiveRef.current = false;
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
        if (voiceEnabledRef.current) {
          void playPatientSpeech({
            text: turn.data.assistantMessage.content,
            locale,
            voiceId: avatar.voice_id,
            voiceIdAr: avatar.voice_id_ar,
            voiceProfileId: avatar.voice_profile_id,
            avatarId: avatar.id,
            speechPace:
              turn.data.voiceHints?.speech_pace ??
              avatar.personality?.speech?.pace ??
              null,
            speechEnergy: turn.data.voiceHints?.speech_energy ?? null,
            disorderSlug,
            stability: turn.data.voiceHints?.stability ?? null,
            style: turn.data.voiceHints?.style ?? null,
            pauseBeforeMs: turn.data.voiceHints?.pause_before_ms ?? null,
            audioRef,
            signal: ticket.signal,
            handlers: {
              onstart: () => ticket.isCurrent() && setSpeaking(true),
              onend: () => {
                if (!ticket.isCurrent()) return;
                setSpeaking(false);
                patientActiveRef.current = false;
              },
              onerror: () => ticket.isCurrent() && setSpeaking(false),
            },
          });
        } else {
          patientActiveRef.current = false;
        }
        setStatus(
          voiceEnabledRef.current
            ? t("status.listeningNext")
            : t("status.textReady"),
        );
      } catch {
        if (!ticket.isCurrent()) return;
        patientActiveRef.current = false;
        setStatus(t("status.networkError"));
      }
    },
    [
      avatar.id,
      avatar.personality?.speech?.pace,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      createSpeechQueue,
      disorderSlug,
      endSession,
      fence,
      interruptPatient,
      locale,
      session.id,
      t,
    ],
  );

  const sendMessage = useCallback(
    (text: string) =>
      realtimeStreaming ? sendRealtimeTurn(text) : sendClassicMessage(text),
    [realtimeStreaming, sendClassicMessage, sendRealtimeTurn],
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

    if (realtimeStreaming) {
      // Realtime: STT → streamed turn (tokens → sentences → progressive TTS).
      let transcript = "";
      try {
        const wav = await recorder.stop();
        const stt = await transcribeTherapistSpeech({
          audio: wav,
          locale: session.language ?? locale,
        });
        if (!stt.ok) {
          if (stt.unavailable) {
            setStatus(t("status.sttUnavailable"));
            startBrowserListen({ autoSend: true });
            return;
          }
          setStatus(stt.error || t("status.transcribeFailed"));
          return;
        }
        transcript = stt.transcript.trim();
        if (!transcript) {
          setStatus(t("status.noSpeech"));
          return;
        }
        setDraft(transcript);
      } catch {
        setStatus(t("status.micTranscribeError"));
        return;
      } finally {
        setPending(false);
      }
      await sendRealtimeTurn(transcript);
      return;
    }

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
        disorderSlug,
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

    if (!listening && realtimeStreaming) {
      // Therapist starts speaking: barge in before capture begins.
      if (interruptPatient()) bargeInRef.current = true;
    }

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
    // Silence progressive TTS but keep any in-flight streamed reply.
    speechQueueRef.current?.abort();
    speechQueueRef.current = null;
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
      <header className="fixed start-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:px-6">
        <Link href={adminTest ? `/admin/avatars/${session.avatar_id}` : "/avatars"} className="flex items-center gap-3">
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
            {ending
              ? adminTest
                ? t("adminTest.ending")
                : t("ending")
              : adminTest
                ? t("adminTest.end")
                : t("end")}
          </button>
        </div>
      </header>

      <div className="pt-16">
        <AdminTestBanner clinicalSnapshot={session.clinical_snapshot} />
      </div>

      <main className="relative flex flex-1 flex-col lg:flex-row">
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
              {ending
                ? adminTest
                  ? t("adminTest.ending")
                  : t("ending")
                : adminTest
                  ? t("adminTest.end")
                  : t("endSession")}
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
            {liveReply && (
              // Provisional streamed draft — presentation only, never persisted;
              // replaced by the validated message when the turn completes.
              <div
                className="max-w-[92%] rounded-xl bg-[var(--surface-container)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--on-surface)] opacity-70"
                aria-live="polite"
                aria-busy="true"
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {avatar.name}
                </p>
                {liveReply}
              </div>
            )}
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

