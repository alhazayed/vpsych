"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionTimer } from "@/components/SessionTimer";
import { PrivateNotebook } from "@/components/therapy-room/PrivateNotebook";
import { AdminTestBanner } from "@/components/admin/AdminTestBanner";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { remainingSeconds } from "@/lib/session-timer";
import {
  ARRIVAL_BEATS,
  DEPARTURE_BEATS,
  beatStartTimes,
  publishRoomPhase,
  resolvePatientNonverbal,
  totalArrivalMs,
  totalDepartureMs,
  type PatientNonverbalProfile,
  type RoomPhase,
} from "@/lib/therapy-room";
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

/**
 * Consultation room — voice-first, no chat bubbles.
 * Room is the interface; floating toolbar only.
 */
export function TherapyRoom({
  session,
  avatar,
  initialMessages,
  appointmentId,
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
  appointmentId?: string | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations("clinic.room");
  const locale = resolvePipelineLocale(session.language, avatar.language);
  const nonverbal = resolvePatientNonverbal(
    session.clinical_snapshot,
    session.clinical_snapshot?.primary_diagnosis?.slug,
  );

  const wantArrive = search.get("arrive") === "1";
  const [phase, setPhase] = useState<RoomPhase>(
    wantArrive ? "arrival" : initialMessages.some((m) => m.role === "user")
      ? "in_session"
      : "awaiting_invite",
  );
  const [arrivalLabel, setArrivalLabel] = useState("");
  const [departureLabel, setDepartureLabel] = useState("");
  const [patientVisible, setPatientVisible] = useState(!wantArrive);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pending, setPending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [riskFlagged, setRiskFlagged] = useState(false);
  const [status, setStatus] = useState(() => t("ready"));
  const [lastPatientLine, setLastPatientLine] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micRecorderRef = useRef<MicRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endingRef = useRef(false);
  const lastAssistantRef = useRef<string | null>(null);

  const stopPlayback = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const setRoomPhase = useCallback((next: RoomPhase) => {
    setPhase(next);
    publishRoomPhase(next, { sessionId: session.id });
  }, [session.id]);

  useEffect(() => {
    if (phase !== "arrival") return;
    const starts = beatStartTimes(ARRIVAL_BEATS);
    const timers: number[] = [];
    ARRIVAL_BEATS.forEach((beat, i) => {
      timers.push(
        window.setTimeout(() => {
          setArrivalLabel(t(`arrival.${beat.id}`));
          if (beat.id === "enter" || beat.id === "sit" || beat.id === "greet") {
            setPatientVisible(true);
          }
          publishRoomPhase("arrival", { beat: beat.id });
        }, starts[i]!),
      );
    });
    timers.push(
      window.setTimeout(() => {
        setRoomPhase("in_session");
        setStatus(t("ready"));
        setArrivalLabel("");
      }, totalArrivalMs()),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [phase, setRoomPhase, t]);

  const runDepartureThenDebrief = useCallback(async () => {
    setRoomPhase("departure");
    const starts = beatStartTimes(DEPARTURE_BEATS);
    await new Promise<void>((resolve) => {
      const timers: number[] = [];
      DEPARTURE_BEATS.forEach((beat, i) => {
        timers.push(
          window.setTimeout(() => {
            setDepartureLabel(t(`departure.${beat.id}`));
            if (beat.id === "leave" || beat.id === "door") {
              setPatientVisible(false);
            }
          }, starts[i]!),
        );
      });
      timers.push(
        window.setTimeout(() => resolve(), totalDepartureMs()),
      );
    });

    if (appointmentId) {
      await fetch(`/api/clinic/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }).catch(() => undefined);
    }

    if (isAdminTestSnapshot(session.clinical_snapshot)) {
      router.push(`/admin/avatars/${session.avatar_id}`);
    } else {
      router.push(`/clinic/room/${session.id}/debrief`);
    }
    router.refresh();
  }, [appointmentId, router, session.avatar_id, session.clinical_snapshot, session.id, setRoomPhase, t]);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setStatus(t("ending"));
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
        setStatus(data.error ?? t("endFailed"));
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
        router.refresh();
        return;
      }
      await runDepartureThenDebrief();
    } catch {
      setStatus(t("endFailed"));
      endingRef.current = false;
      setEnding(false);
    }
  }, [runDepartureThenDebrief, router, session.avatar_id, session.id, stopPlayback, t]);

  useEffect(() => {
    const tick = () => {
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      setRemaining(left);
      if (left <= 0 && !endingRef.current && phase === "in_session") {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endSession, phase, session.max_duration_sec, session.started_at]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      micRecorderRef.current?.cancel();
      stopPlayback();
    };
  }, [stopPlayback]);

  const speak = useCallback(
    async (text: string) => {
      if (muted) return;
      stopPlayback();
      setSpeaking(true);
      lastAssistantRef.current = text;
      setLastPatientLine(text);
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
      muted,
      stopPlayback,
    ],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || endingRef.current || paused) return;
      setPending(true);
      setStatus(t("patientThinking"));
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
          setStatus(turn.error || t("sendFailed"));
          return;
        }
        if (!muted) {
          void speak(turn.data.assistantMessage.content);
        } else {
          lastAssistantRef.current = turn.data.assistantMessage.content;
          setLastPatientLine(turn.data.assistantMessage.content);
        }
        setStatus(t("ready"));
      } catch {
        setStatus(t("networkError"));
      } finally {
        setPending(false);
      }
    },
    [endSession, muted, paused, pending, session.id, speak, t],
  );

  async function stopListen() {
    const recorder = micRecorderRef.current;
    micRecorderRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    if (!recorder) return;

    setStatus(t("transcribing"));
    setPending(true);
    try {
      const wav = await recorder.stop();
      const result = await runVoiceConversationTurn({
        sessionId: session.id,
        audio: wav,
        sessionLanguage: session.language ?? locale,
        locale,
        voiceEnabled: !muted,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        speechPace: avatar.personality?.speech?.pace ?? null,
        disorderSlug: session.clinical_snapshot?.primary_diagnosis?.slug ?? null,
        audioRef,
        speakHandlers: {
          onstart: () => setSpeaking(true),
          onend: () => setSpeaking(false),
          onerror: () => setSpeaking(false),
        },
      });
      if (!result.ok) {
        if (result.expired) {
          await endSession();
          return;
        }
        setStatus(result.error || t("sendFailed"));
        return;
      }
      lastAssistantRef.current = result.turn.assistantMessage.content;
      setLastPatientLine(result.turn.assistantMessage.content);
      setStatus(t("ready"));
    } catch {
      setStatus(t("networkError"));
    } finally {
      setPending(false);
    }
  }

  async function startListen() {
    if (pending || paused || endingRef.current || phase !== "in_session") return;
    stopPlayback();
    setSpeaking(false);
    try {
      micRecorderRef.current = await startMicWavRecording(20000);
    } catch {
      setStatus(t("micDenied"));
      return;
    }
    setListening(true);
    setStatus(t("listening"));

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale === "ar" ? "ar-SA" : "en-US";
      recognition.onerror = () => undefined;
      recognition.onend = () => undefined;
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        /* optional interim only */
      }
    }
  }

  function toggleListen() {
    if (listening) void stopListen();
    else void startListen();
  }

  function interruptPatient() {
    stopPlayback();
    setSpeaking(false);
    setStatus(t("interrupted"));
  }

  function repeatResponse() {
    const line = lastAssistantRef.current;
    if (line) void speak(line);
  }

  const inConsult = phase === "in_session" || phase === "paused";
  const css = nonverbal.cssModifiers;

  return (
    <div className="therapy-room relative flex min-h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">
      <AdminTestBanner clinicalSnapshot={session.clinical_snapshot} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-container)_80%,transparent),var(--background))]"
      />

      <header className="relative z-20 flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <SessionTimer remaining={remaining} />
          {riskFlagged && (
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--error)]">
              {t("riskFlagged")}
            </span>
          )}
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
          {t("consultationRoom")}
        </p>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-28 pt-4">
        {phase === "arrival" && (
          <p className="mb-8 animate-pulse text-sm text-[var(--on-surface-variant)]">
            {arrivalLabel}
          </p>
        )}
        {phase === "departure" && (
          <p className="mb-8 animate-pulse text-sm text-[var(--on-surface-variant)]">
            {departureLabel}
          </p>
        )}

        <div
          className={`relative transition-all duration-[1200ms] ease-out ${
            patientVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-8 opacity-0"
          }`}
          style={{
            transform: patientVisible
              ? `translateY(${css.translateY}px) scale(${speaking ? css.scale * 1.02 : css.scale})`
              : undefined,
            filter: `brightness(${speaking ? css.brightness * 1.05 : css.brightness}) saturate(${css.saturate})`,
            animation: patientVisible
              ? `therapy-breathe ${css.breatheMs}ms ease-in-out infinite`
              : undefined,
          }}
        >
          <PatientStage
            name={avatar.name}
            src={avatar.portrait_url}
            speaking={speaking}
            nonverbal={nonverbal}
          />
        </div>

        <p
          className="mt-8 max-w-md text-center text-sm text-[var(--on-surface-variant)]"
          aria-live="polite"
        >
          {paused ? t("paused") : status}
        </p>

        {/* Hands-free hint — no transcript bubbles */}
        {inConsult && !notesOpen && (
          <button
            type="button"
            className={`mt-8 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--outline-variant)] transition ${
              listening
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "bg-[var(--surface-container-lowest)] text-[var(--primary)]"
            }`}
            aria-pressed={listening}
            aria-label={listening ? t("stopListening") : t("startListening")}
            disabled={pending || ending || paused}
            onClick={() => toggleListen()}
            onContextMenu={(e) => {
              e.preventDefault();
              if (speaking) interruptPatient();
            }}
          >
            <span className="material-symbols-outlined text-[32px]">
              {listening ? "stop" : "mic"}
            </span>
          </button>
        )}
      </div>

      {inConsult && (
        <TherapyToolbar
          paused={paused}
          muted={muted}
          ending={ending}
          onPause={() => {
            setPaused(true);
            setRoomPhase("paused");
            stopPlayback();
            recognitionRef.current?.stop();
            micRecorderRef.current?.cancel();
            setListening(false);
          }}
          onResume={() => {
            setPaused(false);
            setRoomPhase("in_session");
            setStatus(t("ready"));
          }}
          onNotes={() => setNotesOpen((v) => !v)}
          onRisk={() => setRiskFlagged(true)}
          onEmergency={() => {
            setRiskFlagged(true);
            setStatus(t("emergencyArmed"));
          }}
          onRepeat={() => repeatResponse()}
          onMute={() => {
            setMuted((m) => !m);
            if (!muted) stopPlayback();
          }}
          onSettings={() => setSettingsOpen((v) => !v)}
          onEnd={() => void endSession()}
        />
      )}

      {notesOpen && (
        <PrivateNotebook
          sessionId={session.id}
          onClose={() => setNotesOpen(false)}
        />
      )}

      {settingsOpen && (
        <div className="absolute bottom-24 end-4 z-40 max-w-xs rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-sm shadow-lg">
          <p className="font-semibold">{t("settingsTitle")}</p>
          <p className="mt-2 text-[var(--on-surface-variant)]">
            {t("settingsBody")}
          </p>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const text = String(fd.get("line") ?? "");
              void sendMessage(text);
              e.currentTarget.reset();
            }}
          >
            <label className="block text-xs text-[var(--on-surface-variant)]">
              {t("textFallback")}
              <input
                name="line"
                className="mt-1 w-full rounded border border-[var(--outline-variant)] bg-[var(--background)] px-2 py-1.5 text-sm"
                autoComplete="off"
                disabled={pending || paused || ending}
              />
            </label>
          </form>
          <button
            type="button"
            className="mt-3 text-[var(--primary)]"
            onClick={() => setSettingsOpen(false)}
          >
            {t("close")}
          </button>
        </div>
      )}

      {/* Last patient utterance available to screen readers only — not a chat UI */}
      {lastPatientLine && (
        <p className="sr-only" aria-live="polite">
          {lastPatientLine}
        </p>
      )}
    </div>
  );
}

function PatientStage({
  name,
  src,
  speaking,
  nonverbal,
}: {
  name: string;
  src: string | null;
  speaking: boolean;
  nonverbal: PatientNonverbalProfile;
}) {
  return (
    <div
      className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-sm bg-[var(--surface-container)]"
      title={nonverbal.posture}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          className={`object-cover object-top transition duration-700 ${
            speaking ? "brightness-105" : ""
          }`}
          priority
        />
      ) : (
        <div className="flex h-full items-center justify-center font-[family-name:var(--font-headline)] text-6xl font-semibold text-[var(--primary)]">
          {name.slice(0, 1)}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-4 py-6">
        <p className="font-[family-name:var(--font-headline)] text-lg text-white">
          {name.split(/\s+/)[0]}
        </p>
      </div>
    </div>
  );
}

function TherapyToolbar({
  paused,
  muted,
  ending,
  onPause,
  onResume,
  onNotes,
  onRisk,
  onEmergency,
  onRepeat,
  onMute,
  onSettings,
  onEnd,
}: {
  paused: boolean;
  muted: boolean;
  ending: boolean;
  onPause: () => void;
  onResume: () => void;
  onNotes: () => void;
  onRisk: () => void;
  onEmergency: () => void;
  onRepeat: () => void;
  onMute: () => void;
  onSettings: () => void;
  onEnd: () => void;
}) {
  const t = useTranslations("clinic.room.toolbar");
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] transition hover:bg-[var(--surface-container)] disabled:opacity-40";

  return (
    <nav
      aria-label={t("label")}
      className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-3"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[color-mix(in_srgb,var(--surface-container-lowest)_92%,transparent)] px-3 py-2 backdrop-blur-md">
        {paused ? (
          <button type="button" className={btn} aria-label={t("resume")} onClick={onResume}>
            <span className="material-symbols-outlined">play_arrow</span>
          </button>
        ) : (
          <button type="button" className={btn} aria-label={t("pause")} onClick={onPause}>
            <span className="material-symbols-outlined">pause</span>
          </button>
        )}
        <button type="button" className={btn} aria-label={t("notes")} onClick={onNotes}>
          <span className="material-symbols-outlined">edit_note</span>
        </button>
        <button type="button" className={btn} aria-label={t("risk")} onClick={onRisk}>
          <span className="material-symbols-outlined">flag</span>
        </button>
        <button type="button" className={btn} aria-label={t("emergency")} onClick={onEmergency}>
          <span className="material-symbols-outlined">emergency</span>
        </button>
        <button type="button" className={btn} aria-label={t("repeat")} onClick={onRepeat}>
          <span className="material-symbols-outlined">replay</span>
        </button>
        <button
          type="button"
          className={btn}
          aria-label={muted ? t("unmute") : t("mute")}
          aria-pressed={muted}
          onClick={onMute}
        >
          <span className="material-symbols-outlined">
            {muted ? "volume_off" : "volume_up"}
          </span>
        </button>
        <button type="button" className={btn} aria-label={t("settings")} onClick={onSettings}>
          <span className="material-symbols-outlined">settings</span>
        </button>
        <button
          type="button"
          className={`${btn} border-[color-mix(in_srgb,var(--error)_40%,var(--outline-variant))] text-[var(--error)]`}
          aria-label={t("end")}
          disabled={ending}
          onClick={onEnd}
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </nav>
  );
}
