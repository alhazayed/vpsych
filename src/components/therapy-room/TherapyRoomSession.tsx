"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AiAnalysisOverlay } from "@/components/AiAnalysisOverlay";
import { FloatingControls } from "@/components/therapy-room/FloatingControls";
import { LiveTranscript } from "@/components/therapy-room/LiveTranscript";
import { PatientPresence } from "@/components/therapy-room/PatientPresence";
import { PrivateNotesPanel } from "@/components/therapy-room/PrivateNotesPanel";
import { RoomSettingsPanel } from "@/components/therapy-room/RoomSettingsPanel";
import { RoomTimer } from "@/components/therapy-room/RoomTimer";
import { TherapyRoomScene } from "@/components/therapy-room/TherapyRoomScene";
import { remainingSeconds } from "@/lib/session-timer";
import {
  applyHtmlAudioModulation,
  createImmersionTracker,
  DEFAULT_THERAPY_ROOM_THEME,
  derivePatientBehavior,
  shouldPatientInterruptTherapist,
  startBargeInMonitor,
  startHandsFreeVad,
  startRoomAmbience,
  voiceModulationForDisorder,
  type AmbienceController,
  type ImmersionTracker,
  type PatientBehaviorState,
  type TherapyRoomSettings,
  type VadController,
} from "@/lib/therapy-room";
import {
  playPatientSpeech,
  resolvePipelineLocale,
  runVoiceConversationTurn,
  submitConversationTurn,
} from "@/lib/voice/conversation-pipeline";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type {
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";

type RoomPhase =
  | "listening"
  | "processing"
  | "thinking"
  | "speaking"
  | "paused"
  | "ending";

function disorderSlugFrom(session: TherapySession, avatar: ResolvedAvatar): string {
  return (
    session.clinical_snapshot?.primary_diagnosis?.slug ??
    avatar.disorder ??
    "generic"
  );
}

/**
 * Immersive Therapy Room — fullscreen, patient-centered, hands-free.
 * Does not replace VoiceSession; mounted only when interaction_mode=therapy_room.
 */
export function TherapyRoomSession({
  session,
  avatar,
  initialMessages,
  initialNotes = "",
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
  initialNotes?: string;
}) {
  const router = useRouter();
  const t = useTranslations("therapyRoom");
  const locale = resolvePipelineLocale(session.language, avatar.language);
  const disorderSlug = disorderSlugFrom(session, avatar);
  const speechProfile = speechBehaviorForDisorder(disorderSlug);

  const [messages, setMessages] = useState(initialMessages);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<RoomPhase>("listening");
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [lastPatientText, setLastPatientText] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState(() => t("status.ready"));
  const [settings, setSettings] = useState<TherapyRoomSettings>(() => ({
    themeId: DEFAULT_THERAPY_ROOM_THEME,
    showLiveTranscript: false,
    showTimer: true,
    timerMode: "remaining",
    muteAvatar: false,
    ambienceEnabled: true,
    ambienceVolume: 0.02,
  }));

  const [behavior, setBehavior] = useState<PatientBehaviorState>(() =>
    derivePatientBehavior({
      disorderSlug,
      phase: "idle",
      seed: `${session.id}:0`,
    }),
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vadRef = useRef<VadController | null>(null);
  const bargeInStopRef = useRef<(() => void) | null>(null);
  const ambienceRef = useRef<AmbienceController | null>(null);
  const immersionRef = useRef<ImmersionTracker>(createImmersionTracker());
  const endingRef = useRef(false);
  const pausedRef = useRef(false);
  const phaseRef = useRef<RoomPhase>("listening");
  const turnIndexRef = useRef(0);
  const loopActiveRef = useRef(false);
  const mutedRef = useRef(false);
  const notesRef = useRef(notes);
  const listenLoopRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    mutedRef.current = settings.muteAvatar;
  }, [settings.muteAvatar]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const setPresence = useCallback(
    (presencePhase: PatientBehaviorState["phase"], seedExtra = "") => {
      const next = derivePatientBehavior({
        disorderSlug,
        phase: presencePhase,
        seed: `${session.id}:${turnIndexRef.current}:${seedExtra}`,
      });
      setBehavior(next);
      return next;
    },
    [disorderSlug, session.id],
  );

  const stopPlayback = useCallback(() => {
    window.speechSynthesis?.cancel();
    bargeInStopRef.current?.();
    bargeInStopRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const persistSessionMeta = useCallback(
    async (immersion: ReturnType<ImmersionTracker["finalize"]> | null) => {
      try {
        await fetch(`/api/sessions/${session.id}/therapy-room`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privateNotes: notesRef.current,
            immersionMetrics: immersion,
          }),
        });
      } catch {
        /* best-effort — never block end */
      }
    },
    [session.id],
  );

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    loopActiveRef.current = false;
    setEnding(true);
    setPhase("ending");
    setStatusHint(t("status.ending"));
    vadRef.current?.cancel();
    vadRef.current = null;
    stopPlayback();
    ambienceRef.current?.stop();
    ambienceRef.current = null;
    immersionRef.current.track("session_end");
    const immersion = immersionRef.current.finalize();
    await persistSessionMeta(immersion);
    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatusHint(
          typeof data.error === "string" ? data.error : t("status.endFailed"),
        );
        endingRef.current = false;
        setEnding(false);
        setPhase("paused");
        return;
      }
      router.push(`/sessions/${session.id}/complete`);
      router.refresh();
    } catch {
      setStatusHint(t("status.endFailed"));
      endingRef.current = false;
      setEnding(false);
      setPhase("paused");
    }
  }, [persistSessionMeta, router, session.id, stopPlayback, t]);

  const speakPatient = useCallback(
    async (text: string) => {
      if (mutedRef.current || endingRef.current) {
        setPresence("idle", "muted");
        return;
      }
      stopPlayback();
      setPhase("speaking");
      setPresence("speaking", "speak");
      setStatusHint("");

      const mod = voiceModulationForDisorder(
        disorderSlug,
        `${session.id}:${turnIndexRef.current}`,
      );

      let bargeInFired = false;
      bargeInStopRef.current = await startBargeInMonitor({
        onBargeIn: () => {
          if (bargeInFired || endingRef.current) return;
          bargeInFired = true;
          immersionRef.current.track("therapist_interrupt");
          stopPlayback();
          setPresence("interrupted", "barge");
          setStatusHint(t("status.interrupted"));
        },
      });

      await playPatientSpeech({
        text,
        locale,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        speechPace: speechProfile.pace,
        speechEnergy: speechProfile.energy,
        disorderSlug,
        audioRef,
        handlers: {
          onstart: () => {
            if (audioRef.current) {
              applyHtmlAudioModulation(audioRef.current, mod);
            }
            setPhase("speaking");
          },
          onend: () => {
            bargeInStopRef.current?.();
            bargeInStopRef.current = null;
          },
          onerror: () => {
            bargeInStopRef.current?.();
            bargeInStopRef.current = null;
          },
        },
      });

      bargeInStopRef.current?.();
      bargeInStopRef.current = null;
      if (!endingRef.current && !pausedRef.current) {
        setPresence("listening", "after-speak");
      }
    },
    [
      avatar.id,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      disorderSlug,
      locale,
      session.id,
      setPresence,
      speechProfile.energy,
      speechProfile.pace,
      stopPlayback,
      t,
    ],
  );

  const processTherapistAudio = useCallback(
    async (wav: Blob, source: "hands_free" | "patient_interrupt") => {
      if (endingRef.current || pausedRef.current) return;
      setPhase("processing");
      setStatusHint("");
      turnIndexRef.current += 1;

      if (source === "hands_free") {
        immersionRef.current.track("hands_free_turn");
      } else {
        immersionRef.current.track("patient_interrupt");
      }

      const thinking = setPresence(
        "thinking",
        `think-${turnIndexRef.current}`,
      );
      setPhase("thinking");

      const thinkPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, thinking.thinkingLatencyMs);
      });

      const resultPromise = runVoiceConversationTurn({
        sessionId: session.id,
        audio: wav,
        sessionLanguage: session.language ?? locale,
        locale,
        voiceEnabled: false,
        voiceId: avatar.voice_id,
        voiceIdAr: avatar.voice_id_ar,
        voiceProfileId: avatar.voice_profile_id,
        avatarId: avatar.id,
        speechPace: speechProfile.pace,
        onMessages: (userMessage, assistantMessage) => {
          setMessages((prev) => [...prev, userMessage, assistantMessage]);
          setLastPatientText(assistantMessage.content);
        },
      });

      const [, result] = await Promise.all([thinkPromise, resultPromise]);

      if (!result.ok) {
        if (result.expired) {
          await endSession();
          return;
        }
        setStatusHint(
          result.error === "No speech detected"
            ? ""
            : t("status.tryAgain"),
        );
        setPresence("listening", "retry");
        setPhase("listening");
        return;
      }

      setLastPatientText(result.turn.assistantMessage.content);
      await speakPatient(result.turn.assistantMessage.content);
      if (!endingRef.current && !pausedRef.current) {
        setPhase("listening");
        setPresence("listening", "loop");
      }
    },
    [
      avatar.id,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      endSession,
      locale,
      session.id,
      session.language,
      setPresence,
      speakPatient,
      speechProfile.pace,
      t,
    ],
  );

  const startListeningLoop = useCallback(async () => {
    if (
      endingRef.current ||
      pausedRef.current ||
      !loopActiveRef.current ||
      vadRef.current
    ) {
      return;
    }

    setPhase("listening");
    setPresence("listening", `listen-${turnIndexRef.current}`);
    setStatusHint("");

    try {
      const seed = `${session.id}:vad:${turnIndexRef.current}`;
      let interruptedByPatient = false;

      const vad = await startHandsFreeVad({
        silenceMs: 1100,
        maxMs: 28000,
        onSpeechStart: () => {
          setPresence("listening", "therapist-speaking");
        },
        onInterruptCheck: (speechMs) => {
          const hit = shouldPatientInterruptTherapist({
            disorderSlug,
            therapistSpeechMs: speechMs,
            seed,
          });
          if (hit) interruptedByPatient = true;
          return hit;
        },
      });
      vadRef.current = vad;
      const wav = await vad.done;
      vadRef.current = null;

      if (endingRef.current || pausedRef.current || !loopActiveRef.current) {
        return;
      }
      if (!wav) {
        // Empty — keep listening
        listenLoopRef.current();
        return;
      }

      await processTherapistAudio(
        wav,
        interruptedByPatient ? "patient_interrupt" : "hands_free",
      );

      if (!endingRef.current && !pausedRef.current && loopActiveRef.current) {
        listenLoopRef.current();
      }
    } catch {
      setStatusHint(t("status.micDenied"));
      setPhase("paused");
      setPaused(true);
      pausedRef.current = true;
    }
  }, [
    disorderSlug,
    processTherapistAudio,
    session.id,
    setPresence,
    t,
  ]);

  useEffect(() => {
    listenLoopRef.current = () => {
      void startListeningLoop();
    };
  }, [startListeningLoop]);

  // Timer
  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) return;
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      setRemaining(left);
      const elapsedSec = Math.max(
        0,
        session.max_duration_sec - left,
      );
      setElapsed(elapsedSec);
      if (left <= 0 && !endingRef.current) {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endSession, session.max_duration_sec, session.started_at]);

  // Boot: ambience + immersion start + hands-free loop
  useEffect(() => {
    immersionRef.current.track("session_start");
    loopActiveRef.current = true;

    if (settings.ambienceEnabled) {
      ambienceRef.current = startRoomAmbience({
        kind: "hvac",
        volume: settings.ambienceVolume,
      });
    }

    const boot = window.setTimeout(() => {
      listenLoopRef.current();
    }, 600);

    return () => {
      window.clearTimeout(boot);
      loopActiveRef.current = false;
      vadRef.current?.cancel();
      vadRef.current = null;
      stopPlayback();
      ambienceRef.current?.stop();
      ambienceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  // Ambience toggle
  useEffect(() => {
    if (!settings.ambienceEnabled) {
      ambienceRef.current?.stop();
      ambienceRef.current = null;
      return;
    }
    if (!ambienceRef.current) {
      ambienceRef.current = startRoomAmbience({
        kind: "hvac",
        volume: settings.ambienceVolume,
      });
    } else {
      ambienceRef.current.setVolume(settings.ambienceVolume);
    }
  }, [settings.ambienceEnabled, settings.ambienceVolume]);

  // Autosave notes periodically
  useEffect(() => {
    const id = window.setInterval(() => {
      void persistSessionMeta(null);
    }, 45000);
    return () => window.clearInterval(id);
  }, [persistSessionMeta]);

  const handleControl = useCallback(
    (id: string) => {
      immersionRef.current.track("control_open");
      switch (id) {
        case "pause":
          immersionRef.current.track("pause");
          setPaused(true);
          pausedRef.current = true;
          loopActiveRef.current = false;
          vadRef.current?.cancel();
          vadRef.current = null;
          stopPlayback();
          setPhase("paused");
          setPresence("idle", "pause");
          setStatusHint(t("status.paused"));
          break;
        case "resume":
          immersionRef.current.track("resume");
          setPaused(false);
          pausedRef.current = false;
          loopActiveRef.current = true;
          setStatusHint("");
          listenLoopRef.current();
          break;
        case "notes":
          immersionRef.current.track("notes_open");
          setNotesOpen((v) => !v);
          setSettingsOpen(false);
          break;
        case "mute":
          setSettings((s) => ({ ...s, muteAvatar: !s.muteAvatar }));
          if (!settings.muteAvatar) stopPlayback();
          break;
        case "repeat":
          if (lastPatientText) {
            void speakPatient(lastPatientText);
          }
          break;
        case "transcript":
          setTranscriptOpen((v) => {
            const next = !v;
            immersionRef.current.track(
              next ? "transcript_opened" : "transcript_closed",
            );
            return next;
          });
          break;
        case "settings":
          immersionRef.current.track("settings_open");
          setSettingsOpen((v) => !v);
          setNotesOpen(false);
          break;
        case "end":
          void endSession();
          break;
        default:
          break;
      }
    },
    [
      endSession,
      lastPatientText,
      setPresence,
      settings.muteAvatar,
      speakPatient,
      stopPlayback,
      t,
    ],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (e.key === "Escape") {
        setNotesOpen(false);
        setSettingsOpen(false);
        setTranscriptOpen(false);
      } else if (e.key === "p" || e.key === "P") {
        handleControl(pausedRef.current ? "resume" : "pause");
      } else if (e.key === "n" || e.key === "N") {
        handleControl("notes");
      } else if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleControl("end");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleControl]);

  const sendTextFallback = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || endingRef.current) return;
      immersionRef.current.track("text_turn");
      turnIndexRef.current += 1;
      const thinking = setPresence("thinking", `text-${turnIndexRef.current}`);
      setPhase("thinking");
      await new Promise((r) => window.setTimeout(r, thinking.thinkingLatencyMs));
      const turn = await submitConversationTurn({
        sessionId: session.id,
        message: trimmed,
      });
      if (!turn.ok) {
        if (turn.expired) {
          await endSession();
          return;
        }
        setStatusHint(t("status.tryAgain"));
        return;
      }
      setMessages((prev) => [
        ...prev,
        turn.data.userMessage,
        turn.data.assistantMessage,
      ]);
      setLastPatientText(turn.data.assistantMessage.content);
      await speakPatient(turn.data.assistantMessage.content);
      if (!pausedRef.current && loopActiveRef.current) {
        listenLoopRef.current();
      }
    },
    [endSession, session.id, setPresence, speakPatient, t],
  );

  return (
    <div className="trm-root" data-trm="true">
      <TherapyRoomScene themeId={settings.themeId}>
        <RoomTimer
          remaining={remaining}
          elapsed={elapsed}
          mode={settings.timerMode}
          hidden={!settings.showTimer}
          paused={paused}
          onToggleMode={() =>
            setSettings((s) => ({
              ...s,
              timerMode: s.timerMode === "remaining" ? "elapsed" : "remaining",
            }))
          }
          onToggleHidden={() =>
            setSettings((s) => ({ ...s, showTimer: !s.showTimer }))
          }
        />

        <div className="trm-stage">
          <PatientPresence
            name={avatar.name}
            portraitUrl={avatar.portrait_url}
            behavior={behavior}
            muted={settings.muteAvatar}
          />
        </div>

        {statusHint && (
          <p className="trm-hint" role="status">
            {statusHint}
          </p>
        )}

        {/* Accessibility: optional silent text fallback, visually minimal */}
        <form
          className="trm-a11y-input"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get("turn") ?? "");
            e.currentTarget.reset();
            void sendTextFallback(text);
          }}
        >
          <label className="sr-only" htmlFor="trm-turn">
            {t("a11y.typeTurn")}
          </label>
          <input
            id="trm-turn"
            name="turn"
            type="text"
            autoComplete="off"
            placeholder={t("a11y.typeTurn")}
            disabled={ending || phase === "processing" || phase === "thinking"}
          />
        </form>

        <FloatingControls
          paused={paused}
          muted={settings.muteAvatar}
          notesOpen={notesOpen}
          settingsOpen={settingsOpen}
          transcriptOpen={transcriptOpen}
          ending={ending}
          onAction={handleControl}
        />

        <PrivateNotesPanel
          open={notesOpen}
          value={notes}
          onChange={setNotes}
          onClose={() => setNotesOpen(false)}
        />
        <LiveTranscript
          open={transcriptOpen}
          messages={messages}
          onClose={() => {
            immersionRef.current.track("transcript_closed");
            setTranscriptOpen(false);
            setSettings((s) => ({ ...s, showLiveTranscript: false }));
          }}
        />
        <RoomSettingsPanel
          open={settingsOpen}
          settings={settings}
          onChange={(next) => {
            setSettings(next);
            if (next.showLiveTranscript) setTranscriptOpen(true);
            else if (!next.showLiveTranscript && settings.showLiveTranscript) {
              setTranscriptOpen(false);
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      </TherapyRoomScene>

      {ending && <AiAnalysisOverlay />}
    </div>
  );
}
