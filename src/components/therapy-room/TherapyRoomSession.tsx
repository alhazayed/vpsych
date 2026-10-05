"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { VoiceTurnPanel } from "@/components/therapy-room/VoiceTurnPanel";
import { AdminTestBanner } from "@/components/admin/AdminTestBanner";
import { remainingSeconds } from "@/lib/session-timer";
import {
  applyHtmlAudioModulation,
  createConversationFsm,
  createConversationTelemetry,
  createImmersionTracker,
  DEFAULT_THERAPY_ROOM_THEME,
  HANDS_FREE_PERF_BUDGETS,
  shouldPatientInterruptTherapist,
  startBargeInMonitor,
  startHandsFreeVad,
  startRoomAmbience,
  statusKeyForState,
  voiceModulationForDisorder,
  type AmbienceController,
  type BargeInHandoff,
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
  applyAnimationState,
  createAnimationScheduler,
  deriveNonverbalBehavior,
  type AnimationScheduler,
} from "@/lib/nbe";
import {
  playPatientSpeech,
  resolvePipelineLocale,
  submitConversationTurn,
  transcribeTherapistSpeech,
} from "@/lib/voice/conversation-pipeline";
import {
  speechBehaviorForDisorder,
  type SpeechBehaviorProfile,
} from "@/lib/case-engine/speech-behavior";
import {
  beginVoiceTurn,
  describeAudioUnavailable,
  describeVoiceError,
  failVoiceStage,
  initialVoiceDiagnostics,
  isVoiceDebugEnabled,
  markAudioUnavailable,
  markVoiceStage,
  voiceLog,
  wavDurationMs,
  VOICE_STAGES,
  type VoiceTurnDiagnostics,
} from "@/lib/voice/voice-diagnostics";
import type {
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";

/**
 * Barge-in (therapist talks over the patient → patient stops, mic takes the
 * turn). On by default; the monitor calibrates the patient's echo floor before
 * it can fire, so the patient's own clip does not abort itself. Set
 * NEXT_PUBLIC_VOICE_BARGE_IN=false to fall back to strict serial turns. The
 * Interrupt control works either way.
 */
const BARGE_IN_ENABLED = process.env.NEXT_PUBLIC_VOICE_BARGE_IN !== "false";
/** When enabled, barge-in arms only this long after audio is actually playing. */
const BARGE_IN_ARM_DELAY_MS = 400;

const subscribeNoop = () => () => undefined;

function disorderSlugFrom(session: TherapySession, avatar: ResolvedAvatar): string {
  return (
    session.clinical_snapshot?.primary_diagnosis?.slug ||
    avatar.disorder ||
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
  speechHint,
}: {
  session: TherapySession;
  avatar: ResolvedAvatar;
  initialMessages: SessionMessage[];
  initialNotes?: string;
  /**
   * Skill tests: the patient's voice pace and energy, given instead of the
   * disorder so the browser never learns the case.
   */
  speechHint?: Pick<SpeechBehaviorProfile, "pace" | "energy">;
}) {
  const router = useRouter();
  const t = useTranslations("therapyRoom");
  const locale = resolvePipelineLocale(session.language, avatar.language);
  const disorderSlug = disorderSlugFrom(session, avatar);
  const speechProfile = speechHint ?? speechBehaviorForDisorder(disorderSlug);

  const [messages, setMessages] = useState(initialMessages);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [elapsed, setElapsed] = useState(0);
  const [fsmState, setFsmState] = useState<ConversationState>("IDLE");
  const [canInterrupt, setCanInterrupt] = useState(false);
  const [statusKey, setStatusKey] = useState<ConversationStatusKey>("ready");
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [lastPatientText, setLastPatientText] = useState<string | null>(null);
  const [lastTherapistText, setLastTherapistText] = useState<string | null>(null);
  const [therapistPending, setTherapistPending] = useState(false);
  const [patientFallback, setPatientFallback] = useState(false);
  const [voiceDiag, setVoiceDiag] = useState<VoiceTurnDiagnostics>(() =>
    initialVoiceDiagnostics(),
  );
  // Client-only (reads ?voiceDebug=1); server snapshot keeps hydration stable.
  const voiceDebug = useSyncExternalStore(
    subscribeNoop,
    () => isVoiceDebugEnabled(),
    () => false,
  );
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

  const [behavior, setBehavior] = useState<PatientBehaviorState>(() => {
    const packet = deriveNonverbalBehavior({
      disorderSlug,
      phase: "idle",
      seed: `${session.id}:0`,
    });
    return packet.behavior;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nbeSchedulerRef = useRef<AnimationScheduler | null>(null);
  const nbeStartedAtRef = useRef<number>(0);
  const behaviorBaseRef = useRef<PatientBehaviorState>(behavior);
  const vadRef = useRef<VadController | null>(null);
  const bargeInStopRef = useRef<(() => void) | null>(null);
  /** Open mic + captured onset from a voice barge-in, for the next listen. */
  const bargeInHandoffRef = useRef<BargeInHandoff | null>(null);
  /** Interrupts the patient clip that is playing now (null when none). */
  const interruptPatientRef = useRef<(() => void) | null>(null);
  const ambienceRef = useRef<AmbienceController | null>(null);
  const immersionRef = useRef<ImmersionTracker>(createImmersionTracker());
  const telemetryRef = useRef<ConversationTelemetry>(createConversationTelemetry());
  const fsmRef = useRef<ConversationFsm>(createConversationFsm("IDLE"));
  const endingRef = useRef(false);
  const turnIndexRef = useRef(0);
  const mutedRef = useRef(false);
  const notesRef = useRef(notes);
  const listenLoopRef = useRef<() => void>(() => undefined);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const playbackEndedAtRef = useRef<number | null>(null);
  const syncUiRef = useRef<() => void>(() => undefined);

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
      const packet = deriveNonverbalBehavior({
        disorderSlug,
        phase: presencePhase,
        seed: `${session.id}:${turnIndexRef.current}:${seedExtra}`,
      });
      behaviorBaseRef.current = packet.behavior;
      nbeSchedulerRef.current = createAnimationScheduler(packet.timeline);
      nbeStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const framed = applyAnimationState(
        packet.behavior,
        nbeSchedulerRef.current.tick(0),
      );
      setBehavior(framed);
      return framed;
    },
    [disorderSlug, session.id],
  );

  // Drive Nonverbal Behaviour Engine pulses — emotion timeline, anti-repetition.
  useEffect(() => {
    if (!nbeSchedulerRef.current) {
      const packet = deriveNonverbalBehavior({
        disorderSlug,
        phase: behaviorBaseRef.current.phase,
        seed: `${session.id}:boot`,
      });
      behaviorBaseRef.current = packet.behavior;
      nbeSchedulerRef.current = createAnimationScheduler(packet.timeline);
      nbeStartedAtRef.current = performance.now();
    }

    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const loop = () => {
      const scheduler = nbeSchedulerRef.current;
      if (scheduler && !reduced) {
        const elapsed = performance.now() - nbeStartedAtRef.current;
        const state = scheduler.tick(elapsed);
        setBehavior((prev) => {
          const base = behaviorBaseRef.current;
          const next = applyAnimationState(base, state);
          if (
            prev.animationClasses?.join(" ") ===
              next.animationClasses?.join(" ") &&
            prev.activeCues.join() === next.activeCues.join()
          ) {
            return prev;
          }
          return { ...next, phase: base.phase, affect: base.affect };
        });
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [disorderSlug, session.id]);

  const cancelTurnWork = useCallback(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
  }, []);

  const releaseBargeInHandoff = useCallback(() => {
    bargeInHandoffRef.current?.release();
    bargeInHandoffRef.current = null;
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
    releaseBargeInHandoff();
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
      endingRef.current = false;
      setEnding(false);
      dispatch("ERROR");
      setStatusKey("error");
    }
  }, [
    cancelTurnWork,
    dispatch,
    persistSessionMeta,
    releaseBargeInHandoff,
    router,
    session.avatar_id,
    session.id,
    stopPlayback,
  ]);

  /**
   * Play one patient clip for the current turn. Never hangs and never hides
   * the patient text: a failure of both ElevenLabs and browser speech marks
   * "Patient audio unavailable" and the room returns to listening.
   */
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
        setVoiceDiag((d) =>
          markVoiceStage(markVoiceStage(d, "tts", "skipped"), "audio", "skipped", {
            audio_mode: "muted",
          }),
        );
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
      let bargeInArmTimer: number | null = null;
      let ttsFailure: { status?: number; code?: string } | null = null;

      const onBargeIn = (handoff?: BargeInHandoff) => {
        if (bargeInFired || endingRef.current) {
          handoff?.release();
          return;
        }
        if (!fsmRef.current.isCurrent(generation)) {
          handoff?.release();
          return;
        }
        bargeInFired = true;
        interruptPatientRef.current = null;
        setCanInterrupt(false);
        bargeInHandoffRef.current?.release();
        bargeInHandoffRef.current = handoff ?? null;
        voiceLog("TURN", "barge_in", { source: handoff ? "voice" : "control" });
        immersionRef.current.track("therapist_interrupt");
        telemetryRef.current.record("barge_in");
        abort.abort();
        stopPlayback();
        const transitioned = dispatch("BARGE_IN");
        if (transitioned.ok) {
          setPresence("interrupted", "barge");
          setStatusKey("listening");
          setVoiceDiag((d) =>
            markVoiceStage(d, "audio", "ok", { audio_mode: "interrupted" }),
          );
          // Mic reopens immediately — no click required.
          listenLoopRef.current();
        } else {
          releaseBargeInHandoff();
        }
      };
      interruptPatientRef.current = () => onBargeIn();
      setCanInterrupt(true);

      // Arm barge-in only once audio is audibly playing (never during the TTS
      // fetch, never in the first moments while echo cancellation adapts).
      const armBargeIn = () => {
        if (!BARGE_IN_ENABLED || bargeInArmTimer != null) return;
        bargeInArmTimer = window.setTimeout(() => {
          if (abort.signal.aborted || !fsmRef.current.isCurrent(generation)) {
            return;
          }
          void startBargeInMonitor({ onBargeIn }).then((stop) => {
            if (abort.signal.aborted || playbackAbortRef.current !== abort) {
              stop();
              return;
            }
            bargeInStopRef.current = stop;
          });
        }, BARGE_IN_ARM_DELAY_MS);
      };
      const disarmBargeIn = () => {
        if (bargeInArmTimer != null) window.clearTimeout(bargeInArmTimer);
        bargeInStopRef.current?.();
        bargeInStopRef.current = null;
      };

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
          onend: disarmBargeIn,
          onerror: disarmBargeIn,
        },
        onDiagnostic: (event) => {
          if (!fsmRef.current.isCurrent(generation)) return;
          switch (event.event) {
            case "tts_request_started":
              setVoiceDiag((d) => markVoiceStage(d, "tts", "active"));
              break;
            case "tts_response":
              ttsFailure = event.ok
                ? null
                : { status: event.status, code: event.code };
              setVoiceDiag((d) =>
                markVoiceStage(d, "tts", event.ok ? "ok" : "fail", {
                  tts_status: event.status,
                  tts_code: event.code,
                }),
              );
              break;
            case "audio_play_called":
              setVoiceDiag((d) => markVoiceStage(d, "audio", "active"));
              break;
            case "audio_playing":
              if (audioRef.current) {
                applyHtmlAudioModulation(audioRef.current, mod);
              }
              setVoiceDiag((d) =>
                markVoiceStage(d, "audio", "active", { audio_mode: "elevenlabs" }),
              );
              armBargeIn();
              break;
            case "browser_speech_started":
              setVoiceDiag((d) =>
                markVoiceStage(d, "audio", "active", { audio_mode: "browser" }),
              );
              armBargeIn();
              break;
            case "audio_play_rejected":
            case "audio_error":
              setVoiceDiag((d) =>
                markVoiceStage(d, "audio", "active", {
                  audio_error: event.reason,
                }),
              );
              break;
            case "audio_ended":
            case "browser_speech_ended":
              setVoiceDiag((d) => markVoiceStage(d, "audio", "ok"));
              break;
            default:
              break;
          }
        },
        onUnavailable: ({ code, status }) => {
          if (!fsmRef.current.isCurrent(generation)) return;
          const { stage, message } = describeAudioUnavailable({ code, status });
          setVoiceDiag((d) =>
            markAudioUnavailable(markVoiceStage(d, "audio", "fail"), {
              stage,
              code,
              status,
              message,
            }),
          );
        },
      });

      disarmBargeIn();
      if (playbackAbortRef.current === abort) playbackAbortRef.current = null;
      if (!bargeInFired) {
        interruptPatientRef.current = null;
        setCanInterrupt(false);
      }

      telemetryRef.current.record("playback_duration_ms", {
        valueMs: telemetryRef.current.elapsed(playbackStarted),
      });
      voiceLog("TURN", "playback_finished", { mode });

      if (bargeInFired || mode === "interrupted") {
        return;
      }

      if (mode === "browser") {
        // Audible, but not the patient's voice: say so instead of passing off
        // the browser's robotic fallback as the real patient audio.
        const failure = ttsFailure as { status?: number; code?: string } | null;
        setVoiceDiag((d) => ({
          ...markVoiceStage(d, "audio", "ok", { audio_mode: "browser" }),
          audioDegraded: failure
            ? {
                stage: "tts",
                code: failure.code,
                status: failure.status,
                message: describeVoiceError({
                  stage: "tts",
                  code: failure.code,
                  status: failure.status,
                }),
              }
            : null,
        }));
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
      releaseBargeInHandoff,
      session.id,
      setPresence,
      speechProfile.energy,
      speechProfile.pace,
      stopPlayback,
    ],
  );

  /** Append a saved turn; ids are DB uuids so a re-delivery never duplicates. */
  const appendTurnMessages = useCallback(
    (userMessage: SessionMessage, assistantMessage: SessionMessage) => {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const next = [...prev];
        if (!seen.has(userMessage.id)) next.push(userMessage);
        if (!seen.has(assistantMessage.id)) next.push(assistantMessage);
        return next;
      });
    },
    [],
  );

  const processTherapistAudio = useCallback(
    async (wav: Blob, source: "hands_free" | "patient_interrupt") => {
      if (endingRef.current) return;
      const generation = fsmRef.current.getGeneration();

      const speechEnd = dispatch("SPEECH_END");
      if (!speechEnd.ok) return;

      turnIndexRef.current += 1;
      setTherapistSpeaking(false);
      setVoiceDiag((d) =>
        markVoiceStage(
          markVoiceStage(beginVoiceTurn(d), "recording", "ok", {
            blob_size: wav.size,
            blob_type: wav.type || "(none)",
            blob_duration_ms: wavDurationMs(wav.size),
          }),
          "stt",
          "active",
        ),
      );

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
        setVoiceDiag((d) =>
          failVoiceStage(d, {
            stage: "stt",
            code: "NETWORK",
            message: describeVoiceError({ stage: "stt", code: "NETWORK" }),
          }),
        );
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
          stt.code === "EMPTY_RECORDING" ||
          stt.error === "No speech detected" ||
          /no speech|empty/i.test(stt.error)
        ) {
          setVoiceDiag((d) =>
            markVoiceStage(markVoiceStage(d, "stt", "skipped"), "transcript", "skipped", {
              note: "empty recording — still listening",
            }),
          );
          dispatch("STT_EMPTY");
          setPresence("listening", "retry");
          listenLoopRef.current();
          return;
        }
        setVoiceDiag((d) =>
          failVoiceStage(
            markVoiceStage(d, "stt", "fail", {
              stt_status: stt.status,
              stt_code: stt.code,
            }),
            {
              stage: "stt",
              code: stt.code,
              status: stt.status,
              message: describeVoiceError({
                stage: "stt",
                code: stt.code,
                status: stt.status,
                message: stt.error,
              }),
            },
          ),
        );
        dispatch("STT_FAIL");
        setStatusKey("error");
        return;
      }

      const transcript = stt.transcript.trim();
      if (!transcript) {
        setVoiceDiag((d) =>
          markVoiceStage(markVoiceStage(d, "stt", "ok"), "transcript", "skipped", {
            stt_transcript_length: 0,
            note: "no speech detected — still listening",
          }),
        );
        dispatch("STT_EMPTY");
        setPresence("listening", "empty");
        listenLoopRef.current();
        return;
      }

      if (!dispatch("STT_OK").ok) return;

      // The therapist's words are visible the moment STT returns — before the
      // message API, and independent of TTS / playback.
      setLastTherapistText(transcript);
      setTherapistPending(true);
      setLastPatientText(null);
      setPatientFallback(false);
      setVoiceDiag((d) =>
        markVoiceStage(
          markVoiceStage(markVoiceStage(d, "stt", "ok"), "transcript", "ok", {
            stt_transcript_length: transcript.length,
          }),
          "message",
          "active",
        ),
      );

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
        setVoiceDiag((d) =>
          failVoiceStage(d, {
            stage: "message",
            code: "NETWORK",
            message: describeVoiceError({ stage: "message", code: "NETWORK" }),
          }),
        );
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
        const failed = turn;
        setVoiceDiag((d) =>
          failVoiceStage(d, {
            stage: "message",
            code: failed.code,
            status: failed.status,
            message: describeVoiceError({
              stage: "message",
              code: failed.code,
              status: failed.status,
              message: failed.error,
            }),
          }),
        );
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }

      appendTurnMessages(turn.data.userMessage, turn.data.assistantMessage);
      setTherapistPending(false);
      setLastTherapistText(turn.data.userMessage.content);
      setLastPatientText(turn.data.assistantMessage.content);
      setPatientFallback(turn.data.aiSource === "persona_fallback");
      setVoiceDiag((d) =>
        markVoiceStage(markVoiceStage(d, "message", "ok"), "patientText", "ok", {
          ai_source: turn.data.aiSource ?? "unknown",
          patient_text_length: turn.data.assistantMessage.content?.length ?? 0,
        }),
      );

      // Transition into AVATAR_SPEAKING before TTS. Text is already visible.
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
      appendTurnMessages,
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
    // Take the barge-in mic (if any) now so a bail-out below can release it.
    const handoff = bargeInHandoffRef.current;
    bargeInHandoffRef.current = null;
    if (endingRef.current || vadRef.current) {
      handoff?.release();
      return;
    }
    const state = fsmRef.current.getState();
    if (state !== "LISTENING") {
      handoff?.release();
      return;
    }

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

    try {
      const seed = `${session.id}:vad:${turnIndexRef.current}`;
      let interruptedByPatient = false;
      const speechStartedAt = { current: null as number | null };

      const vad = await startHandsFreeVad({
        silenceMs: HANDS_FREE_PERF_BUDGETS.defaultSilenceMs,
        maxMs: 28000,
        // After a voice barge-in, keep listening on the same open mic and
        // keep the words already spoken, so the turn starts at its first word.
        stream: handoff?.stream,
        preroll: handoff
          ? {
              samples: handoff.preroll,
              sampleRate: handoff.sampleRate,
              speechMs: handoff.speechMs,
            }
          : undefined,
        onSpeechStart: () => {
          voiceLog("MIC", "recording_started");
          setVoiceDiag((d) => markVoiceStage(d, "recording", "active"));
          speechStartedAt.current = telemetryRef.current.mark();
          setTherapistSpeaking(true);
          setPresence("listening", "therapist-speaking");
        },
        onSpeechEnd: () => {
          voiceLog("MIC", "recording_stopped");
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

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
        vad.cancel();
        return;
      }
      if (fsmRef.current.getState() !== "LISTENING") {
        vad.cancel();
        return;
      }

      vadRef.current = vad;
      setVoiceDiag((d) => markVoiceStage(d, "mic", "ok"));
      const wav = await vad.done;
      vadRef.current = null;

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
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

      try {
        await processTherapistAudio(
          wav,
          interruptedByPatient ? "patient_interrupt" : "hands_free",
        );
      } catch (turnErr) {
        // A bug inside the turn must not be reported as a microphone error,
        // and must never leave the room silently stuck.
        console.error("[VOICE][TURN] unexpected turn failure", turnErr);
        setVoiceDiag((d) => {
          const stage =
            VOICE_STAGES.find((s) => d.stages[s] === "active") ?? "message";
          return failVoiceStage(d, {
            stage,
            code: "UNEXPECTED",
            message: describeVoiceError({
              stage,
              message: "unexpected client error",
            }),
          });
        });
        if (!endingRef.current) {
          dispatch("ERROR");
          setStatusKey("error");
        }
      }
    } catch (err) {
      handoff?.release();
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: unknown }).name)
          : "error";
      voiceLog("MIC", "mic_error", { name });
      setVoiceDiag((d) =>
        failVoiceStage(d, {
          stage: "mic",
          code: name,
          message: describeVoiceError({
            stage: "mic",
            message:
              name === "NotAllowedError"
                ? "microphone permission was denied"
                : name === "NotFoundError"
                  ? "no microphone was found"
                  : `could not open the microphone (${name})`,
          }),
        }),
      );
      telemetryRef.current.record("error", { code: "mic_denied" });
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
  useEffect(() => {
    // React Strict Mode (dev) runs mount → cleanup → mount. The cleanup below
    // sets endingRef=true; without this reset every later turn would bail out
    // on `endingRef.current` and the room would never listen.
    endingRef.current = false;
    immersionRef.current.track("session_start");
    telemetryRef.current.record("session_start");
    dispatch("START");

    if (settings.ambienceEnabled) {
      ambienceRef.current = startRoomAmbience({
        kind: "hvac",
        volume: settings.ambienceVolume,
      });
    }

    const boot = window.setTimeout(() => {
      listenLoopRef.current();
    }, 400);

    return () => {
      window.clearTimeout(boot);
      endingRef.current = true;
      const fsm = fsmRef.current;
      fsm.reset("IDLE");
      vadRef.current?.cancel();
      vadRef.current = null;
      releaseBargeInHandoff();
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
    telemetryRef.current.record("retry");
    setVoiceDiag((d) => ({ ...d, error: null }));
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
          releaseBargeInHandoff();
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
        case "interrupt":
          interruptPatientRef.current?.();
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
      releaseBargeInHandoff,
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
      if (
        e.code === "Space" &&
        interruptPatientRef.current &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        handleControl("interrupt");
      } else if (e.key === "Escape") {
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

      setLastTherapistText(trimmed);
      setTherapistPending(true);
      setLastPatientText(null);
      setVoiceDiag((d) =>
        markVoiceStage(
          markVoiceStage(beginVoiceTurn(d), "transcript", "ok", { input: "text" }),
          "message",
          "active",
        ),
      );
      let turn;
      try {
        turn = await submitConversationTurn({
          sessionId: session.id,
          message: trimmed,
        });
      } catch {
        setVoiceDiag((d) =>
          failVoiceStage(d, {
            stage: "message",
            code: "NETWORK",
            message: describeVoiceError({ stage: "message", code: "NETWORK" }),
          }),
        );
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }
      if (!turn.ok) {
        if (turn.expired) {
          await endSession();
          return;
        }
        const failed = turn;
        setVoiceDiag((d) =>
          failVoiceStage(d, {
            stage: "message",
            code: failed.code,
            status: failed.status,
            message: describeVoiceError({
              stage: "message",
              code: failed.code,
              status: failed.status,
              message: failed.error,
            }),
          }),
        );
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }
      appendTurnMessages(turn.data.userMessage, turn.data.assistantMessage);
      setTherapistPending(false);
      setLastPatientText(turn.data.assistantMessage.content);
      setPatientFallback(turn.data.aiSource === "persona_fallback");
      setVoiceDiag((d) =>
        markVoiceStage(markVoiceStage(d, "message", "ok"), "patientText", "ok", {
          ai_source: turn.data.aiSource ?? "unknown",
        }),
      );
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
    [appendTurnMessages, dispatch, endSession, session.id, setPresence, speakPatient],
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
      <AdminTestBanner clinicalSnapshot={session.clinical_snapshot} />
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

        <VoiceTurnPanel
          therapistText={lastTherapistText}
          therapistPending={therapistPending}
          patientText={lastPatientText}
          patientFallback={patientFallback}
          diagnostics={voiceDiag}
          debug={voiceDebug}
          onPlayAudio={
            voiceDiag.audioUnavailable && lastPatientText
              ? () => handleControl("repeat")
              : undefined
          }
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
          canInterrupt={canInterrupt}
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
