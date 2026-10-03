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
  type ConversationFsm,
  type ConversationState,
  type ConversationStatusKey,
  type ConversationTelemetry,
  type ImmersionTracker,
  type PatientBehaviorState,
  type TherapyRoomSettings,
  type VadController,
} from "@/lib/therapy-room";
import type { BargeInHandoff } from "@/lib/therapy-room/vad";
import {
  createEndpointController,
  type EndpointController,
  type SpeculativeSttResult,
} from "@/lib/voice/endpoint-controller";
import { ENDPOINT_TIMING } from "@/lib/voice/endpointing";
import { effectivePauseBeforeMs } from "@/lib/voice/response-timing";
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
import { createTherapistInterruptedFlag } from "@/lib/voice/interrupt-flag";
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

/** Held replies older than this are not voiced (conversation moved on). */
const HELD_REPLY_MAX_AGE_MS = 20_000;
/**
 * Continuous therapist speech needed to take the floor while the patient
 * reply is generating (stricter than barge-in: nothing is playing yet, so a
 * false positive would cost a reply rather than stop audio).
 */
const FLOOR_TAKE_MIN_SPEECH_MS = 450;

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
  /**
   * Phase 9.1R — mark on barge-in; consume only on valid replacement submit
   * (empty STT must not clear the latch).
   */
  const interruptFlagRef = useRef(createTherapistInterruptedFlag());
  /**
   * Human Conversation Fidelity — two-stage endpoint for the open capture,
   * live mic handed over by a barge-in / floor-take (pre-roll keeps the
   * therapist's first words), end-of-speech anchor for response timing,
   * and a reply held while the therapist took the floor.
   */
  const endpointRef = useRef<EndpointController | null>(null);
  const handoffRef = useRef<BargeInHandoff | null>(null);
  const lastVoicedAtRef = useRef<number | null>(null);
  const floorTakenGenRef = useRef<number | null>(null);
  const heldReplyRef = useRef<{
    userMessage: SessionMessage;
    assistantMessage: SessionMessage;
    heldAt: number;
  } | null>(null);

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
    endpointRef.current?.cancel();
    endpointRef.current = null;
    handoffRef.current?.release();
    handoffRef.current = null;
    floorTakenGenRef.current = null;
    heldReplyRef.current = null;
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
    interruptFlagRef.current.clear();
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
    router,
    session.avatar_id,
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
      /** True once patient audio is actually audible (play() resolved). */
      let firstAudioStarted = false;

      /** Playback finished / cancelled — a late monitor must stop itself. */
      let playbackDone = false;
      // Start the barge-in mic in PARALLEL with TTS: getUserMedia +
      // AudioContext startup must not delay the first patient word. First
      // audio needs ≥1 TTS round-trip, so the monitor is live before it.
      const monitorReady = startBargeInMonitor({
        // Hand the live mic + pre-roll to capture so the interruption's first
        // words ("طيب بس…") reach STT instead of being lost to mic reopen.
        handoff: true,
        onBargeIn: (handoff) => {
          if (bargeInFired || endingRef.current) {
            handoff?.release();
            return;
          }
          if (!fsmRef.current.isCurrent(generation)) {
            handoff?.release();
            return;
          }
          bargeInFired = true;
          // Only a cut-off of AUDIBLE patient speech is an interruption.
          // Speaking before the patient's first word is taking the floor.
          if (firstAudioStarted) {
            interruptFlagRef.current.mark();
            immersionRef.current.track("therapist_interrupt");
            telemetryRef.current.record("barge_in");
          } else {
            telemetryRef.current.record("floor_yield", {
              code: "before_first_audio",
            });
          }
          if (handoff) {
            telemetryRef.current.record("barge_in_detect_ms", {
              valueMs: handoff.detectLatencyMs,
            });
          }
          abort.abort();
          stopPlayback();
          if (handoff) {
            telemetryRef.current.record("barge_in_stop_ms", {
              valueMs: performance.now() - handoff.detectedAt,
            });
          }
          const transitioned = dispatch("BARGE_IN");
          if (transitioned.ok) {
            handoffRef.current?.release();
            handoffRef.current = handoff ?? null;
            setPresence("interrupted", "barge");
            setStatusKey("listening");
            // Mic reopens immediately — no click required.
            listenLoopRef.current();
          } else {
            handoff?.release();
          }
        },
      });
      void monitorReady.then((stopMonitor) => {
        // Playback may have ended or been cancelled while the mic started.
        if (
          playbackDone ||
          abort.signal.aborted ||
          !fsmRef.current.isCurrent(generation)
        ) {
          stopMonitor();
        } else {
          bargeInStopRef.current = stopMonitor;
        }
      });

      const spoken = await playPatientSpeech({
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
        turn: {
          turnId: generation,
          isActive: (id) => fsmRef.current.isCurrent(id),
        },
        onQueueEvent: (event) => {
          if (event.type === "tts_chunk_failed") {
            telemetryRef.current.record("tts_failure");
          } else if (event.type === "audio_play_rejected") {
            telemetryRef.current.record("playback_failure", {
              code: event.errorName,
            });
          }
        },
        handlers: {
          onstart: () => {
            if (!fsmRef.current.isCurrent(generation)) return;
            firstAudioStarted = true;
            if (audioRef.current) {
              applyHtmlAudioModulation(audioRef.current, mod);
            }
          },
          onend: () => {
            playbackDone = true;
            bargeInStopRef.current?.();
            bargeInStopRef.current = null;
          },
          onerror: () => {
            // Not final: a legacy-Blob fallback may still play after this.
            bargeInStopRef.current?.();
            bargeInStopRef.current = null;
          },
        },
      });

      playbackDone = true;
      bargeInStopRef.current?.();
      bargeInStopRef.current = null;
      playbackAbortRef.current = null;

      // Phase 9.2 — split generation vs playback (do not mix into one number).
      if (spoken.metrics.ttsTotalGenerationMs != null) {
        telemetryRef.current.record("tts_generation_latency_ms", {
          valueMs: spoken.metrics.ttsTotalGenerationMs,
        });
        // Backward-compatible alias: generation only (not full playback).
        telemetryRef.current.record("tts_latency_ms", {
          valueMs: spoken.metrics.ttsTotalGenerationMs,
        });
      }
      // Phase 9.2R — only when play() resolved successfully (not on attempt).
      if (spoken.metrics.ttsFirstAudioPlayMs != null) {
        telemetryRef.current.record("time_to_first_patient_audio_ms", {
          valueMs: spoken.metrics.ttsFirstAudioPlayMs,
        });
      }
      const playbackMs =
        spoken.metrics.totalPatientAudioDurationMs ??
        telemetryRef.current.elapsed(playbackStarted);
      telemetryRef.current.record("patient_playback_duration_ms", {
        valueMs: playbackMs,
      });
      telemetryRef.current.record("playback_duration_ms", {
        valueMs: playbackMs,
      });
      telemetryRef.current.record("tts_playback_path", {
        code: spoken.playbackPath,
      });
      telemetryRef.current.record("tts_chunks_generated", {
        count: spoken.metrics.chunkCount,
      });
      telemetryRef.current.record("tts_chunks_played", {
        count: spoken.metrics.chunksPlayed,
      });

      if (bargeInFired || spoken.mode === "interrupted") {
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

  /**
   * Human Conversation Fidelity — replay a reply that arrived while the
   * therapist had the floor, when what they said turned out to be nothing
   * (noise / no speech). The reply was already persisted server-side.
   */
  const playHeldReply = useCallback((): boolean => {
    const held = heldReplyRef.current;
    heldReplyRef.current = null;
    if (!held || endingRef.current) return false;
    const append = () =>
      setMessages((prev) => [...prev, held.userMessage, held.assistantMessage]);
    if (performance.now() - held.heldAt > HELD_REPLY_MAX_AGE_MS) {
      // Too old to voice naturally; keep the transcript consistent with DB.
      append();
      return false;
    }
    if (!dispatch("HELD_REPLY").ok) {
      heldReplyRef.current = held;
      return false;
    }
    append();
    setLastPatientText(held.assistantMessage.content);
    telemetryRef.current.record("held_reply_played");
    const gen = fsmRef.current.getGeneration();
    void speakPatient(held.assistantMessage.content, gen).then(() => {
      if (
        fsmRef.current.isCurrent(gen) &&
        !endingRef.current &&
        fsmRef.current.getState() === "LISTENING"
      ) {
        listenLoopRef.current();
      }
    });
    return true;
  }, [dispatch, speakPatient]);

  /** After a capture that produced no usable speech: held reply or listen. */
  const resumeAfterEmptyCapture = useCallback(() => {
    if (!playHeldReply()) listenLoopRef.current();
  }, [playHeldReply]);

  /** Stash a reply that arrived after the therapist took the floor. */
  const holdReply = useCallback(
    (userMessage: SessionMessage, assistantMessage: SessionMessage) => {
      floorTakenGenRef.current = null;
      heldReplyRef.current = {
        userMessage,
        assistantMessage,
        heldAt: performance.now(),
      };
      // The floor-take capture already ended empty and a fresh listen has
      // heard nothing yet → the therapist is waiting for an answer.
      const vad = vadRef.current;
      if (
        fsmRef.current.getState() === "LISTENING" &&
        (!vad || vad.speechMs() === 0)
      ) {
        vad?.cancel();
        vadRef.current = null;
        endpointRef.current?.cancel();
        endpointRef.current = null;
        playHeldReply();
      }
    },
    [playHeldReply],
  );

  const processTherapistAudio = useCallback(
    async (
      wav: Blob,
      source: "hands_free" | "patient_interrupt",
      /** Speculative transcript for exactly this audio (two-stage endpoint). */
      preStt?: SpeculativeSttResult | null,
    ) => {
      if (endingRef.current) return;
      const generation = fsmRef.current.getGeneration();
      // End-of-speech anchor for response timing (Human Conversation Fidelity).
      const speechEndedAt = lastVoicedAtRef.current ?? performance.now();
      lastVoicedAtRef.current = null;

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

      // A pending floor-take keeps the earlier request alive so its reply can
      // be held (and replayed if this capture turns out empty).
      if (floorTakenGenRef.current == null) {
        turnAbortRef.current?.abort();
      }
      const abort = new AbortController();
      turnAbortRef.current = abort;

      setStatusKey("processingStt");

      let stt: SpeculativeSttResult;
      if (preStt) {
        // Two-stage endpoint already transcribed exactly this audio.
        stt = preStt;
        telemetryRef.current.record("speculative_stt_reused");
      } else {
        const sttStarted = telemetryRef.current.mark();
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
      }

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
          resumeAfterEmptyCapture();
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
        resumeAfterEmptyCapture();
        return;
      }

      if (!dispatch("STT_OK").ok) return;

      // A real new therapist turn supersedes any reply held during a
      // floor-take. It was persisted server-side, so keep the visible
      // transcript consistent with the record (it was never voiced).
      floorTakenGenRef.current = null;
      const held = heldReplyRef.current;
      heldReplyRef.current = null;
      if (held) {
        setMessages((prev) => [
          ...prev,
          held.userMessage,
          held.assistantMessage,
        ]);
      }

      // Clinical thinking latency overlaps the GPT request and is measured
      // from end-of-speech, so it never stacks on STT time.
      const thinkMs = effectivePauseBeforeMs({
        pauseBeforeMs: thinking.thinkingLatencyMs,
        anchorAt: speechEndedAt,
        now: performance.now(),
      });
      const thinkPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, thinkMs);
      });

      setStatusKey("thinking");
      const gptStarted = telemetryRef.current.mark();

      // Consume only now — after non-empty transcript (Phase 9.1R Fix 3).
      const therapistInterrupted = interruptFlagRef.current.consumeForSubmit();

      // Floor control: if the therapist starts a new utterance while the
      // reply is generating, the patient yields instead of talking over them.
      let floorDisposed = false;
      let floorStop: (() => void) | null = null;
      const disposeFloor = () => {
        floorDisposed = true;
        floorStop?.();
        floorStop = null;
      };
      void startBargeInMonitor({
        handoff: true,
        minSpeechMs: FLOOR_TAKE_MIN_SPEECH_MS,
        onBargeIn: (handoff) => {
          if (
            floorDisposed ||
            endingRef.current ||
            !fsmRef.current.isCurrent(generation) ||
            fsmRef.current.getState() !== "WAITING_GPT"
          ) {
            handoff?.release();
            return;
          }
          floorDisposed = true;
          floorStop = null;
          if (!dispatch("THERAPIST_RESUMED").ok) {
            handoff?.release();
            return;
          }
          floorTakenGenRef.current = generation;
          telemetryRef.current.record("floor_yield", {
            code: "during_generation",
          });
          handoffRef.current?.release();
          handoffRef.current = handoff ?? null;
          setPresence("listening", "floor");
          setStatusKey("listening");
          listenLoopRef.current();
        },
      }).then((stop) => {
        if (floorDisposed) stop();
        else floorStop = stop;
      });

      let turn;
      try {
        const [, result] = await Promise.all([
          thinkPromise,
          submitConversationTurn({
            sessionId: session.id,
            message: transcript,
            therapistInterrupted,
            signal: abort.signal,
          }),
        ]);
        turn = result;
      } catch {
        disposeFloor();
        if (abort.signal.aborted) return;
        if (!fsmRef.current.isCurrent(generation)) return;
        telemetryRef.current.record("error", { code: "gpt_network" });
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }
      disposeFloor();

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
        if (
          turn.ok &&
          !endingRef.current &&
          floorTakenGenRef.current === generation
        ) {
          holdReply(turn.data.userMessage, turn.data.assistantMessage);
        } else {
          telemetryRef.current.record("stale_result_discarded");
        }
        return;
      }

      telemetryRef.current.record("gpt_latency_ms", {
        valueMs: telemetryRef.current.elapsed(gptStarted),
      });

      if (!turn.ok) {
        // Phase 9.1S — superseded is a normal stale-turn outcome, not GPT_FAIL.
        if (turn.aborted || turn.superseded) return;
        if (turn.expired) {
          await endSession();
          return;
        }
        telemetryRef.current.record("error", { code: "gpt_fail" });
        dispatch("GPT_FAIL");
        setStatusKey("error");
        return;
      }

      // Drop UI/playback updates if barge-in superseded this generation mid-flight.
      if (!fsmRef.current.isCurrent(generation) || endingRef.current) return;

      setMessages((prev) => [
        ...prev,
        turn.data.userMessage,
        turn.data.assistantMessage,
      ]);
      setLastPatientText(turn.data.assistantMessage.content);

      // Transition into AVATAR_SPEAKING before TTS.
      if (!dispatch("GPT_OK").ok) return;

      // speakPatient records tts_generation / time_to_first_audio / playback.
      await speakPatient(turn.data.assistantMessage.content, generation);
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
      holdReply,
      locale,
      resumeAfterEmptyCapture,
      session.id,
      session.language,
      setPresence,
      speakPatient,
    ],
  );

  const startListeningLoop = useCallback(async () => {
    if (endingRef.current) return;
    const state = fsmRef.current.getState();
    if (state !== "LISTENING") return;
    if (vadRef.current) return;

    const generation = fsmRef.current.getGeneration();
    // Live mic + pre-roll from a barge-in / floor-take, if any.
    const handoff = handoffRef.current;
    handoffRef.current = null;
    setPresence("listening", `listen-${turnIndexRef.current}`);
    setStatusKey("listening");
    setTherapistSpeaking(Boolean(handoff));

    if (playbackEndedAtRef.current != null) {
      telemetryRef.current.record("mic_reopen_latency_ms", {
        valueMs: telemetryRef.current.elapsed(playbackEndedAtRef.current),
      });
      playbackEndedAtRef.current = null;
    }

    let controller: EndpointController | null = null;
    try {
      const seed = `${session.id}:vad:${turnIndexRef.current}`;
      let interruptedByPatient = false;
      const speechStartedAt = { current: null as number | null };
      let vadLocal: VadController | null = null;
      let commitRequested = false;

      // Two-stage endpoint: a pause triggers speculative STT while the mic
      // stays open; unfinished thoughts get more silence before commit.
      controller = createEndpointController({
        locale: locale === "ar" ? "ar" : "en",
        transcribe: async (audio, signal) => {
          const sttStarted = telemetryRef.current.mark();
          const result = await transcribeTherapistSpeech({
            audio,
            locale: session.language ?? locale,
            signal,
          });
          // Speculative STT is the main share of pause → commit time.
          if (!signal.aborted) {
            telemetryRef.current.record("stt_latency_ms", {
              valueMs: telemetryRef.current.elapsed(sttStarted),
              code: "speculative",
            });
          }
          return result;
        },
        onCommit: () => {
          commitRequested = true;
          void vadLocal?.stop();
        },
        onEvent: (event) => {
          if (event.type === "pause") {
            telemetryRef.current.record("endpoint_pause");
          } else if (event.type === "resumed") {
            telemetryRef.current.record("endpoint_resumed");
          } else if (event.type === "commit") {
            telemetryRef.current.record("endpoint_commit_silence_ms", {
              valueMs: event.silenceMs,
              code: event.reason,
            });
            if (event.reason === "vad_finished") {
              // Hit the max-silence ceiling (slow STT or unfinished thought).
              telemetryRef.current.record("endpoint_max_silence_commit");
            }
          }
        },
      });
      endpointRef.current = controller;
      const endpoint = controller;

      const vad = await startHandsFreeVad({
        silenceMs: HANDS_FREE_PERF_BUDGETS.defaultSilenceMs,
        maxMs: 28000,
        stream: handoff?.stream,
        adoptStream: Boolean(handoff),
        // Drained on the VAD's first audio callback: no capture gap.
        preroll: handoff ? (cutoff: number) => handoff.drain(cutoff) : undefined,
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
        twoStage: {
          maxSilenceMs: ENDPOINT_TIMING.maxSilenceMs,
          resumeMinMs: ENDPOINT_TIMING.resumeMinMs,
          onPause: (info) => {
            if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
              return;
            }
            // VAD timestamps are Date.now()-based; anchor on performance.now().
            const voicedAt =
              performance.now() - Math.max(0, Date.now() - info.silenceStartedAt);
            lastVoicedAtRef.current = voicedAt;
            dispatch("PAUSE_DETECTED");
            setTherapistSpeaking(false);
            endpoint.pause({
              wav: info.wav,
              speechMs: info.speechMs,
              silenceStartedAt: voicedAt,
            });
          },
          onActivity: (active) => {
            // Possible resume: hold the commit until confirmed or rejected.
            endpoint.activity(active);
          },
          onResume: () => {
            if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
              return;
            }
            lastVoicedAtRef.current = null;
            endpoint.resumed();
            dispatch("SPEECH_RESUMED");
            setTherapistSpeaking(true);
          },
        },
      });
      vadLocal = vad;

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
        vad.cancel();
        endpoint.cancel();
        return;
      }
      if (fsmRef.current.getState() !== "LISTENING") {
        vad.cancel();
        endpoint.cancel();
        return;
      }

      vadRef.current = vad;
      if (commitRequested) void vad.stop();
      const wav = await vad.done;
      if (vadRef.current === vad) vadRef.current = null;
      const finalized = await endpoint.finalize();
      if (endpointRef.current === endpoint) endpointRef.current = null;

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) {
        return;
      }
      const after = fsmRef.current.getState();
      if (after !== "LISTENING" && after !== "ENDPOINT_PENDING") {
        return;
      }
      if (!wav) {
        // Empty — keep listening (or voice a held reply).
        if (after === "ENDPOINT_PENDING") dispatch("SPEECH_RESUMED");
        resumeAfterEmptyCapture();
        return;
      }

      await processTherapistAudio(
        wav,
        interruptedByPatient ? "patient_interrupt" : "hands_free",
        finalized.stt,
      );
    } catch {
      controller?.cancel();
      handoff?.release();
      telemetryRef.current.record("error", { code: "mic_denied" });
      dispatch("ERROR");
      setStatusKey("error");
      setPresence("idle", "mic-error");
    }
  }, [
    dispatch,
    disorderSlug,
    locale,
    processTherapistAudio,
    resumeAfterEmptyCapture,
    session.id,
    session.language,
    setPresence,
  ]);

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
            // Replay without advancing turn index / transcript / clinical state.
            // Phase 9.2R — same VoiceTurnGuard fencing as normal patient playback.
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
                  turn: {
                    turnId: gen,
                    isActive: (id) => fsmRef.current.isCurrent(id),
                  },
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

      // Text while patient is speaking counts as therapist interruption.
      if (fsmRef.current.getState() === "AVATAR_SPEAKING") {
        interruptFlagRef.current.mark();
        stopPlayback();
        dispatch("BARGE_IN");
      }

      immersionRef.current.track("text_turn");
      turnIndexRef.current += 1;
      const generation = fsmRef.current.getGeneration();

      // Text path: enter STT/GPT pipeline without mic.
      const textState = fsmRef.current.getState();
      if (textState === "LISTENING" || textState === "ENDPOINT_PENDING") {
        endpointRef.current?.cancel();
        endpointRef.current = null;
        vadRef.current?.cancel();
        vadRef.current = null;
        dispatch("SPEECH_END");
      }
      const thinking = setPresence("thinking", `text-${turnIndexRef.current}`);
      setStatusKey("thinking");
      await new Promise((r) => window.setTimeout(r, thinking.thinkingLatencyMs));

      if (!fsmRef.current.isCurrent(generation) || endingRef.current) return;

      if (fsmRef.current.getState() === "PROCESSING_STT") {
        dispatch("STT_OK");
      }

      const therapistInterrupted = interruptFlagRef.current.consumeForSubmit();

      turnAbortRef.current?.abort();
      const abort = new AbortController();
      turnAbortRef.current = abort;

      const turn = await submitConversationTurn({
        sessionId: session.id,
        message: trimmed,
        therapistInterrupted,
        signal: abort.signal,
      });
      if (!fsmRef.current.isCurrent(generation) || endingRef.current) return;
      if (!turn.ok) {
        if (turn.aborted || turn.superseded) return;
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
    [dispatch, endSession, session.id, setPresence, speakPatient, stopPlayback],
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
