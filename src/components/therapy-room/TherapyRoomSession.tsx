"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AiAnalysisOverlay } from "@/components/AiAnalysisOverlay";
import { ConversationStatus } from "@/components/therapy-room/ConversationStatus";
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
  createConversationFsm,
  createConversationTelemetry,
  createImmersionTracker,
  DEFAULT_THERAPY_ROOM_THEME,
  derivePatientBehavior,
  HANDS_FREE_PERF_BUDGETS,
  shouldPatientInterruptTherapist,
  startBargeInMonitor,
  startHandsFreeVad,
  startRoomAmbience,
  statusKeyForState,
  takePrimedMicrophone,
  voiceModulationForDisorder,
  type AmbienceController,
  type ConversationFsm,
  type ConversationState,
  type ConversationStatusKey,
  type ConversationTelemetry,
  type ImmersionTracker,
  type PatientBehaviorState,
  type TherapyRoomSettings,
  type VadController,
} from "@/lib/therapy-room";
import {
  playPatientSpeech,
  resolvePipelineLocale,
  submitConversationTurn,
  transcribeTherapistSpeech,
} from "@/lib/voice/conversation-pipeline";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type {
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";

function disorderSlugFrom(session: TherapySession, avatar: ResolvedAvatar): string {
  return (
    session.clinical_snapshot?.primary_diagnosis?.slug ??
    avatar.disorder ??
    "generic"
  );
}

/**
 * Immersive Therapy Room — fullscreen, patient-centered, true hands-free.
 * Explicit conversation FSM; mic opens automatically after Start / TTS end.
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
  const [fsmState, setFsmState] = useState<ConversationState>("IDLE");
  const [statusKey, setStatusKey] = useState<ConversationStatusKey>("ready");
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [lastPatientText, setLastPatientText] = useState<string | null>(null);
  const [therapistSpeaking, setTherapistSpeaking] = useState(false);
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
  const telemetryRef = useRef<ConversationTelemetry>(createConversationTelemetry());
  const fsmRef = useRef<ConversationFsm>(createConversationFsm("IDLE"));
  /** Only set by endSession — never by effect cleanup (StrictMode-safe). */
  const endingRef = useRef(false);
  /** False after unmount / effect cleanup; gates async listen work. */
  const mountedRef = useRef(true);
  const turnIndexRef = useRef(0);
  const mutedRef = useRef(false);
  const notesRef = useRef(notes);
  const listenLoopRef = useRef<() => void>(() => undefined);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const playbackEndedAtRef = useRef<number | null>(null);
  const syncUiRef = useRef<() => void>(() => undefined);
  /** Stream primed on Enter Therapy Room click (user-gesture getUserMedia). */
  const primedStreamRef = useRef<MediaStream | null>(null);

  const syncUi = useCallback(() => {
    const state = fsmRef.current.getState();
    setFsmState(state);
    setPaused(state === "PAUSED");
    setStatusKey(
      statusKeyForState(state, {
        ending: endingRef.current,
      }),
    );
  }, []);

  useEffect(() => {
    syncUiRef.current = syncUi;
  }, [syncUi]);

  useEffect(() => {
    mutedRef.current = settings.muteAvatar;
  }, [settings.muteAvatar]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const dispatch = useCallback(
    (event: Parameters<ConversationFsm["dispatch"]>[0]) => {
      const result = fsmRef.current.dispatch(event);
      if (result.ok) {
        syncUiRef.current();
      }
      return result;
    },
    [],
  );

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

  const cancelTurnWork = useCallback(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
  }, []);

  const stopPlayback = useCallback(() => {
    window.speechSynthesis?.cancel();
    bargeInStopRef.current?.();
    bargeInStopRef.current = null;
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
  }, []);

  const persistSessionMeta = useCallback(
    async (immersion: ReturnType<ImmersionTracker["finalize"]> | null) => {
      try {
        const telemetry = telemetryRef.current.countersOnly();
        await fetch(`/api/sessions/${session.id}/therapy-room`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privateNotes: notesRef.current,
            immersionMetrics: immersion
              ? { ...immersion, conversationTelemetry: telemetry }
              : { conversationTelemetry: telemetry },
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
    setEnding(true);
    dispatch("END");
    setStatusKey("ending");
    vadRef.current?.cancel();
    vadRef.current = null;
    cancelTurnWork();
    stopPlayback();
    ambienceRef.current?.stop();
    ambienceRef.current = null;
    immersionRef.current.track("session_end");
    telemetryRef.current.record("session_end");
    const immersion = immersionRef.current.finalize();
    await persistSessionMeta(immersion);
    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatusKey("error");
        endingRef.current = false;
        setEnding(false);
        dispatch("ERROR");
        setStatusKey(
          typeof data.error === "string" ? "error" : "error",
        );
        return;
      }
      router.push(`/sessions/${session.id}/complete`);
      router.refresh();
    } catch {
      endingRef.current = false;
      setEnding(false);
      dispatch("ERROR");
      setStatusKey("error");
    }
  }, [
    cancelTurnWork,
    dispatch,
    persistSessionMeta,
    router,
    session.id,
    stopPlayback,
  ]);

  const speakPatient = useCallback(
    async (text: string, generation: number) => {
      if (endingRef.current || !fsmRef.current.isCurrent(generation)) {
        return;
      }

      // Caller transitions WAITING_GPT → AVATAR_SPEAKING via GPT_OK.
      if (fsmRef.current.getState() !== "AVATAR_SPEAKING") {
        return;
      }

      if (mutedRef.current) {
        setPresence("idle", "muted");
        dispatch("PLAYBACK_END");
        playbackEndedAtRef.current = telemetryRef.current.mark();
        return;
      }

      stopPlayback();
      setPresence("speaking", "speak");
      setStatusKey("avatarSpeaking");

      const mod = voiceModulationForDisorder(
        disorderSlug,
        `${session.id}:${turnIndexRef.current}`,
      );

      const abort = new AbortController();
      playbackAbortRef.current = abort;
      const playbackStarted = telemetryRef.current.mark();
      let bargeInFired = false;

      bargeInStopRef.current = await startBargeInMonitor({
        onBargeIn: () => {
          if (bargeInFired || endingRef.current) return;
          if (!fsmRef.current.isCurrent(generation)) return;
          bargeInFired = true;
          immersionRef.current.track("therapist_interrupt");
          telemetryRef.current.record("barge_in");
          abort.abort();
          stopPlayback();
          const transitioned = dispatch("BARGE_IN");
          if (transitioned.ok) {
            setPresence("interrupted", "barge");
            setStatusKey("listening");
            // Mic reopens immediately — no click required.
            listenLoopRef.current();
          }
        },
      });

      const mode = await playPatientSpeech({
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
        signal: abort.signal,
        handlers: {
          onstart: () => {
            if (audioRef.current) {
              applyHtmlAudioModulation(audioRef.current, mod);
            }
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
      playbackAbortRef.current = null;

      telemetryRef.current.record("playback_duration_ms", {
        valueMs: telemetryRef.current.elapsed(playbackStarted),
      });

      if (bargeInFired || mode === "interrupted") {
        return;
      }

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
        return;
      }

      if (fsmRef.current.getState() === "AVATAR_SPEAKING") {
        dispatch("PLAYBACK_END");
        playbackEndedAtRef.current = telemetryRef.current.mark();
        setPresence("listening", "after-speak");
      }
    },
    [
      avatar.id,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      dispatch,
      disorderSlug,
      locale,
      session.id,
      setPresence,
      speechProfile.energy,
      speechProfile.pace,
      stopPlayback,
    ],
  );

  const processTherapistAudio = useCallback(
    async (wav: Blob, source: "hands_free" | "patient_interrupt") => {
      if (endingRef.current) return;
      const generation = fsmRef.current.getGeneration();

      const speechEnd = dispatch("SPEECH_END");
      if (!speechEnd.ok) return;

      turnIndexRef.current += 1;
      setTherapistSpeaking(false);

      if (source === "hands_free") {
        immersionRef.current.track("hands_free_turn");
      } else {
        immersionRef.current.track("patient_interrupt");
      }

      const thinking = setPresence(
        "thinking",
        `think-${turnIndexRef.current}`,
      );

      turnAbortRef.current?.abort();
      const abort = new AbortController();
      turnAbortRef.current = abort;

      const sttStarted = telemetryRef.current.mark();
      setStatusKey("processingStt");

      let stt;
      try {
        stt = await transcribeTherapistSpeech({
          audio: wav,
          locale: session.language ?? locale,
          signal: abort.signal,
        });
      } catch {
        if (abort.signal.aborted) return;
        telemetryRef.current.record("error", { code: "stt_network" });
        dispatch("STT_FAIL");
        setStatusKey("error");
        return;
      }

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) return;

      telemetryRef.current.record("stt_latency_ms", {
        valueMs: telemetryRef.current.elapsed(sttStarted),
      });

      if (!stt.ok) {
        telemetryRef.current.record("error", {
          code: stt.code ?? "stt_fail",
        });
        if (
          stt.error === "No speech detected" ||
          /no speech|empty/i.test(stt.error)
        ) {
          dispatch("STT_EMPTY");
          setPresence("listening", "retry");
          listenLoopRef.current();
          return;
        }
        dispatch("STT_FAIL");
        setStatusKey("error");
        return;
      }

      const transcript = stt.transcript.trim();
      if (!transcript) {
        dispatch("STT_EMPTY");
        setPresence("listening", "empty");
        listenLoopRef.current();
        return;
      }

      if (!dispatch("STT_OK").ok) return;

      // Clinical thinking latency overlaps GPT request.
      const thinkPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, thinking.thinkingLatencyMs);
      });

      setStatusKey("thinking");
      const gptStarted = telemetryRef.current.mark();

      let turn;
      try {
        const [, result] = await Promise.all([
          thinkPromise,
          submitConversationTurn({
            sessionId: session.id,
            message: transcript,
            signal: abort.signal,
          }),
        ]);
        turn = result;
      } catch {
        if (abort.signal.aborted) return;
        telemetryRef.current.record("error", { code: "gpt_network" });
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) return;

      telemetryRef.current.record("gpt_latency_ms", {
        valueMs: telemetryRef.current.elapsed(gptStarted),
      });

      if (!turn.ok) {
        if (turn.expired) {
          await endSession();
          return;
        }
        telemetryRef.current.record("error", { code: "gpt_fail" });
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }

      setMessages((prev) => [
        ...prev,
        turn.data.userMessage,
        turn.data.assistantMessage,
      ]);
      setLastPatientText(turn.data.assistantMessage.content);

      // Transition into AVATAR_SPEAKING before TTS.
      if (!dispatch("GPT_OK").ok) return;

      const ttsStarted = telemetryRef.current.mark();
      await speakPatient(turn.data.assistantMessage.content, generation);
      telemetryRef.current.record("tts_latency_ms", {
        valueMs: telemetryRef.current.elapsed(ttsStarted),
      });
      telemetryRef.current.record("turn_complete");

      if (
        fsmRef.current.isCurrent(generation) &&
        !endingRef.current &&
        fsmRef.current.getState() === "LISTENING"
      ) {
        listenLoopRef.current();
      }
    },
    [
      dispatch,
      endSession,
      locale,
      session.id,
      session.language,
      setPresence,
      speakPatient,
    ],
  );

  const startListeningLoop = useCallback(async () => {
    if (endingRef.current || !mountedRef.current) return;
    const state = fsmRef.current.getState();
    if (state !== "LISTENING") return;
    if (vadRef.current) return;

    const generation = fsmRef.current.getGeneration();
    setPresence("listening", `listen-${turnIndexRef.current}`);
    setStatusKey("listening");
    setTherapistSpeaking(false);

    if (playbackEndedAtRef.current != null) {
      telemetryRef.current.record("mic_reopen_latency_ms", {
        valueMs: telemetryRef.current.elapsed(playbackEndedAtRef.current),
      });
      playbackEndedAtRef.current = null;
    }

    // Prefer the stream primed under the Start Session user gesture.
    const primed = primedStreamRef.current;
    primedStreamRef.current = null;

    try {
      const seed = `${session.id}:vad:${turnIndexRef.current}`;
      let interruptedByPatient = false;
      const speechStartedAt = { current: null as number | null };

      const vad = await startHandsFreeVad({
        silenceMs: HANDS_FREE_PERF_BUDGETS.defaultSilenceMs,
        maxMs: 28000,
        stream: primed ?? undefined,
        onSpeechStart: () => {
          speechStartedAt.current = telemetryRef.current.mark();
          setTherapistSpeaking(true);
          setPresence("listening", "therapist-speaking");
        },
        onSpeechEnd: () => {
          setTherapistSpeaking(false);
          if (speechStartedAt.current != null) {
            telemetryRef.current.record("speech_duration_ms", {
              valueMs: telemetryRef.current.elapsed(speechStartedAt.current),
            });
          }
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

      if (
        !mountedRef.current ||
        !fsmRef.current.isCurrent(generation) ||
        endingRef.current
      ) {
        vad.cancel();
        return;
      }
      if (fsmRef.current.getState() !== "LISTENING") {
        vad.cancel();
        return;
      }

      vadRef.current = vad;
      const wav = await vad.done;
      vadRef.current = null;

      if (
        !mountedRef.current ||
        !fsmRef.current.isCurrent(generation) ||
        endingRef.current
      ) {
        return;
      }
      if (fsmRef.current.getState() !== "LISTENING") {
        return;
      }
      if (!wav) {
        // Empty — keep listening without leaving LISTENING.
        listenLoopRef.current();
        return;
      }

      await processTherapistAudio(
        wav,
        interruptedByPatient ? "patient_interrupt" : "hands_free",
      );
    } catch (err) {
      // Release a failed primed stream so Retry can re-acquire under its click.
      primed?.getTracks().forEach((t) => t.stop());
      console.error("[therapy-room] hands-free mic/VAD failed", err);
      telemetryRef.current.record("error", { code: "mic_denied" });
      if (!mountedRef.current || endingRef.current) return;
      dispatch("ERROR");
      setStatusKey("error");
      setPresence("idle", "mic-error");
    }
  }, [dispatch, disorderSlug, processTherapistAudio, session.id, setPresence]);

  useEffect(() => {
    listenLoopRef.current = () => {
      void startListeningLoop();
    };
  }, [startListeningLoop]);

  // Timer
  useEffect(() => {
    const tick = () => {
      if (fsmRef.current.getState() === "PAUSED") return;
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      setRemaining(left);
      const elapsedSec = Math.max(0, session.max_duration_sec - left);
      setElapsed(elapsedSec);
      if (left <= 0 && !endingRef.current) {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endSession, session.max_duration_sec, session.started_at]);

  // Boot: ambience + immersion + automatic listening (no mic click).
  //
  // CRITICAL: never set endingRef in this cleanup. endingRef means "session is
  // ending" and is checked by startListeningLoop / handleRetry. React StrictMode
  // re-runs this effect on the same instance; poisoning endingRef left the room
  // stuck (or Retry dead) after the first mount cleanup.
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    endingRef.current = false;

    immersionRef.current.track("session_start");
    telemetryRef.current.record("session_start");
    dispatch("START");

    // Claim mic acquired under the Enter Therapy Room click (user gesture).
    const primed = takePrimedMicrophone();
    if (primed) {
      primedStreamRef.current = primed;
    }

    if (settings.ambienceEnabled) {
      ambienceRef.current = startRoomAmbience({
        kind: "hvac",
        volume: settings.ambienceVolume,
      });
    }

    // Start listen ASAP — permission already primed when Start was clicked.
    const boot = window.setTimeout(() => {
      if (!cancelled) listenLoopRef.current();
    }, 0);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.clearTimeout(boot);
      const fsm = fsmRef.current;
      fsm.reset("IDLE");
      vadRef.current?.cancel();
      vadRef.current = null;
      primedStreamRef.current?.getTracks().forEach((t) => t.stop());
      primedStreamRef.current = null;
      cancelTurnWork();
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

  const handleRetry = useCallback(() => {
    if (endingRef.current) return;
    // Retry is itself a user gesture — safe to re-acquire the mic here.
    mountedRef.current = true;
    telemetryRef.current.record("retry");
    const result = dispatch("RETRY");
    if (result.ok) {
      setStatusKey("listening");
      listenLoopRef.current();
    }
  }, [dispatch]);

  const handleControl = useCallback(
    (id: string) => {
      immersionRef.current.track("control_open");
      switch (id) {
        case "pause": {
          immersionRef.current.track("pause");
          telemetryRef.current.record("pause");
          vadRef.current?.cancel();
          vadRef.current = null;
          cancelTurnWork();
          stopPlayback();
          dispatch("PAUSE");
          setPresence("idle", "pause");
          setStatusKey("paused");
          break;
        }
        case "resume": {
          immersionRef.current.track("resume");
          telemetryRef.current.record("resume");
          const result = dispatch("RESUME");
          if (result.ok) {
            setStatusKey("listening");
            listenLoopRef.current();
          }
          break;
        }
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
          if (lastPatientText && fsmRef.current.getState() !== "PAUSED") {
            // Replay without advancing turn index / transcript.
            const gen = fsmRef.current.getGeneration();
            if (fsmRef.current.getState() === "LISTENING") {
              vadRef.current?.cancel();
              vadRef.current = null;
              // Temporarily move to waiting then speaking via GPT_OK path:
              // force AVATAR_SPEAKING by SPEECH_END is wrong — use a soft speak.
              void (async () => {
                // Enter speaking from LISTENING is not legal via GPT_OK.
                // Pause listen, speak, then resume listen without FSM GPT path:
                stopPlayback();
                setPresence("speaking", "repeat");
                setStatusKey("avatarSpeaking");
                const abort = new AbortController();
                playbackAbortRef.current = abort;
                await playPatientSpeech({
                  text: lastPatientText,
                  locale,
                  voiceId: avatar.voice_id,
                  voiceIdAr: avatar.voice_id_ar,
                  voiceProfileId: avatar.voice_profile_id,
                  avatarId: avatar.id,
                  speechPace: speechProfile.pace,
                  speechEnergy: speechProfile.energy,
                  disorderSlug,
                  audioRef,
                  signal: abort.signal,
                });
                playbackAbortRef.current = null;
                if (
                  fsmRef.current.isCurrent(gen) &&
                  fsmRef.current.getState() === "LISTENING" &&
                  !endingRef.current
                ) {
                  setPresence("listening", "after-repeat");
                  setStatusKey("listening");
                  listenLoopRef.current();
                }
              })();
            }
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
      avatar.id,
      avatar.voice_id,
      avatar.voice_id_ar,
      avatar.voice_profile_id,
      cancelTurnWork,
      dispatch,
      disorderSlug,
      endSession,
      lastPatientText,
      locale,
      setPresence,
      settings.muteAvatar,
      speechProfile.energy,
      speechProfile.pace,
      stopPlayback,
    ],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }
      if (e.key === "Escape") {
        setNotesOpen(false);
        setSettingsOpen(false);
        setTranscriptOpen(false);
      } else if (e.key === "p" || e.key === "P") {
        handleControl(
          fsmRef.current.getState() === "PAUSED" ? "resume" : "pause",
        );
      } else if (e.key === "n" || e.key === "N") {
        handleControl("notes");
      } else if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleControl("end");
      } else if ((e.key === "r" || e.key === "R") && fsmRef.current.getState() === "ERROR") {
        handleRetry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleControl, handleRetry]);

  const sendTextFallback = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || endingRef.current) return;
      if (fsmRef.current.getState() === "PAUSED") return;

      immersionRef.current.track("text_turn");
      turnIndexRef.current += 1;
      const generation = fsmRef.current.getGeneration();

      // Text path: enter STT/GPT pipeline without mic.
      if (fsmRef.current.getState() === "LISTENING") {
        dispatch("SPEECH_END");
      }
      const thinking = setPresence("thinking", `text-${turnIndexRef.current}`);
      setStatusKey("thinking");
      await new Promise((r) => window.setTimeout(r, thinking.thinkingLatencyMs));

      if (fsmRef.current.getState() === "PROCESSING_STT") {
        dispatch("STT_OK");
      }

      const turn = await submitConversationTurn({
        sessionId: session.id,
        message: trimmed,
      });
      if (!turn.ok) {
        if (turn.expired) {
          await endSession();
          return;
        }
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }
      setMessages((prev) => [
        ...prev,
        turn.data.userMessage,
        turn.data.assistantMessage,
      ]);
      setLastPatientText(turn.data.assistantMessage.content);
      if (!dispatch("GPT_OK").ok) {
        // May already be WAITING_GPT
      }
      await speakPatient(turn.data.assistantMessage.content, generation);
      if (
        fsmRef.current.isCurrent(generation) &&
        fsmRef.current.getState() === "LISTENING"
      ) {
        listenLoopRef.current();
      }
    },
    [dispatch, endSession, session.id, setPresence, speakPatient],
  );

  const busy =
    fsmState === "PROCESSING_STT" ||
    fsmState === "WAITING_GPT" ||
    ending;

  return (
    <div
      className="trm-root"
      data-trm="true"
      data-trm-hands-free="true"
      data-conversation-state={fsmState}
    >
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

        <ConversationStatus
          statusKey={statusKey}
          fsmState={fsmState}
          therapistSpeaking={therapistSpeaking}
          onRetry={handleRetry}
        />

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
            disabled={busy}
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
