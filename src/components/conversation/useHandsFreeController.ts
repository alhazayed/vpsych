"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConversationController,
  canSubmitTranscript,
  composeTtsText,
  computeThinkingDelayMs,
  createEmptyMetrics,
  createPendingTurnGuard,
  markTurnFailed,
  markTurnInFlight,
  markTurnSucceeded,
  metricsPayload,
  pmeUxCuesFromSession,
  recordNetworkDisconnect,
  recordPause,
  recordTurn,
  selectVocalization,
  sleepMs,
  startContinuousMic,
  type ContinuousMicSession,
  type HfteSessionMetrics,
  type NetworkStatus,
  type PendingTurnGuard,
  type SessionStatusKind,
  type VoiceConversationPreferences,
  type WaveformSample,
} from "@/lib/conversation";
import {
  playAudioWithInterrupt,
  stopAllSpeech,
  type PlaybackHandle,
} from "@/lib/conversation/tts-playback";
import {
  resolvePipelineLocale,
  submitConversationTurn,
  transcribeTherapistSpeech,
} from "@/lib/voice/conversation-pipeline";
import { synthesizeSpeech, speakWithBrowser } from "@/lib/voice/client";
import type {
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";

export type HandsFreeControllerApi = {
  statusKind: SessionStatusKind;
  conversationState: string;
  waveSamples: WaveformSample[];
  privateNotes: string;
  setPrivateNotes: (v: string) => void;
  showPrivateNotes: boolean;
  setShowPrivateNotes: (v: boolean | ((p: boolean) => boolean)) => void;
  paused: boolean;
  avatarMuted: boolean;
  networkStatus: NetworkStatus;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  toggleAvatarMute: () => void;
  repeatLastAnswer: () => void;
  remainingOverride: number | null;
  started: boolean;
};

type HostCallbacks = {
  onPreferencesPatch: (patch: Partial<VoiceConversationPreferences>) => void;
  onMessages: (user: SessionMessage, assistant: SessionMessage) => void;
  onStatusText: (text: string) => void;
  onEndSession: () => void;
  onConfirmEnd: () => void;
  avatar: ResolvedAvatar;
  session: TherapySession;
  locale: "en" | "ar";
};

/**
 * Hands-free conversation orchestration.
 * Reuses existing STT → message API → TTS pipeline; does not alter clinical engines.
 */
export function useHandsFreeController(params: {
  enabled: boolean;
  session: TherapySession;
  avatar: ResolvedAvatar;
  preferences: VoiceConversationPreferences;
  onPreferencesPatch: (patch: Partial<VoiceConversationPreferences>) => void;
  onMessages: (user: SessionMessage, assistant: SessionMessage) => void;
  onStatusText: (text: string) => void;
  onEndSession: () => void;
  onConfirmEnd: () => void;
  ending: boolean;
}): HandsFreeControllerApi {
  const {
    enabled,
    session,
    avatar,
    preferences,
    onPreferencesPatch,
    onMessages,
    onStatusText,
    onEndSession,
    onConfirmEnd,
    ending,
  } = params;

  const locale = resolvePipelineLocale(session.language, avatar.language);
  const controllerRef = useRef(new ConversationController("Listening"));
  const micRef = useRef<ContinuousMicSession | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const guardRef = useRef<PendingTurnGuard>(createPendingTurnGuard());
  const metricsRef = useRef<HfteSessionMetrics>(
    createEmptyMetrics(session.id),
  );
  const lastAssistantRef = useRef<string>("");
  const interruptedRef = useRef(false);
  const processingRef = useRef(false);
  const prefsRef = useRef(preferences);
  const endingRef = useRef(ending);
  const networkRef = useRef<NetworkStatus>("online");
  const hostRef = useRef<HostCallbacks>({
    onPreferencesPatch,
    onMessages,
    onStatusText,
    onEndSession,
    onConfirmEnd,
    avatar,
    session,
    locale,
  });

  const [conversationState, setConversationState] = useState("Listening");
  const [statusKind, setStatusKind] = useState<SessionStatusKind>("ready");
  const [waveSamples, setWaveSamples] = useState<WaveformSample[]>([]);
  const [privateNotes, setPrivateNotes] = useState("");
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);
  const [paused, setPaused] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("online");
  const [remainingOverride] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    prefsRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    endingRef.current = ending;
  }, [ending]);

  useEffect(() => {
    networkRef.current = networkStatus;
  }, [networkStatus]);

  useEffect(() => {
    hostRef.current = {
      onPreferencesPatch,
      onMessages,
      onStatusText,
      onEndSession,
      onConfirmEnd,
      avatar,
      session,
      locale,
    };
  }, [
    onPreferencesPatch,
    onMessages,
    onStatusText,
    onEndSession,
    onConfirmEnd,
    avatar,
    session,
    locale,
  ]);

  function setUiStatus(kind: SessionStatusKind, text?: string) {
    setStatusKind(kind);
    if (text) hostRef.current.onStatusText(text);
  }

  function flushMetrics() {
    const payload = metricsPayload(metricsRef.current);
    void fetch(`/api/sessions/${session.id}/hfte-metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      /* best-effort */
    });
  }

  async function playAssistant(clinicalText: string) {
    const prefs = prefsRef.current;
    const host = hostRef.current;
    if (prefs.muteAvatar || !clinicalText.trim()) {
      controllerRef.current.tryTransition("Listening");
      setConversationState("Listening");
      setUiStatus("listening");
      micRef.current?.setInterruptMode(false);
      micRef.current?.resumeCapture();
      return;
    }

    const cues = pmeUxCuesFromSession({
      avatar: host.avatar,
      clinicalSnapshot: host.session.clinical_snapshot,
    });
    const delayMs = computeThinkingDelayMs(cues, {
      scale: prefs.thinkingDelayScale,
    });
    setUiStatus("thinking");
    const thinkAbort = new AbortController();
    abortRef.current = thinkAbort;
    try {
      await sleepMs(delayMs, thinkAbort.signal);
    } catch {
      return;
    }

    metricsRef.current = {
      ...metricsRef.current,
      thinkingLatencyMs: metricsRef.current.thinkingLatencyMs + delayMs,
    };

    const vocal = selectVocalization(cues, host.locale);
    if (vocal.pauseBeforeMs > 0) {
      try {
        await sleepMs(vocal.pauseBeforeMs, thinkAbort.signal);
      } catch {
        return;
      }
    }
    const ttsText = composeTtsText(clinicalText, vocal);
    lastAssistantRef.current = clinicalText;

    if (!controllerRef.current.tryTransition("AvatarSpeaking")) {
      if (controllerRef.current.getState() === "Listening") {
        controllerRef.current.tryTransition("Processing");
        controllerRef.current.tryTransition("AvatarSpeaking");
      }
    }
    setConversationState("AvatarSpeaking");
    setUiStatus("patientSpeaking");

    if (prefs.autoInterrupt) {
      micRef.current?.setInterruptMode(true);
      micRef.current?.resumeCapture();
    } else {
      micRef.current?.pauseCapture();
    }

    const synth = await synthesizeSpeech({
      text: ttsText,
      locale: host.locale,
      voiceId: host.avatar.voice_id,
      voiceIdAr: host.avatar.voice_id_ar,
      voiceProfileId: host.avatar.voice_profile_id,
      avatarId: host.avatar.id,
    });

    const onDone = () => {
      playbackRef.current = null;
      if (controllerRef.current.getState() === "AvatarSpeaking") {
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        setUiStatus("listening");
        micRef.current?.setInterruptMode(false);
        micRef.current?.resumeCapture();
      }
    };

    if (synth.mode === "elevenlabs" && synth.objectUrl) {
      playbackRef.current = await playAudioWithInterrupt({
        objectUrl: synth.objectUrl,
        audioRef: audioElRef,
        onend: onDone,
        onerror: onDone,
      });
    } else {
      speakWithBrowser(ttsText, host.locale, {
        onend: onDone,
        onerror: onDone,
      });
    }
  }

  async function handleUtterance(
    wav: Blob,
    meta: { durationMs: number; confidence: number },
  ) {
    if (processingRef.current || endingRef.current) return;
    if (
      controllerRef.current.isPaused() ||
      controllerRef.current.isFinished()
    ) {
      return;
    }

    processingRef.current = true;
    interruptedRef.current = false;
    const host = hostRef.current;

    if (controllerRef.current.getState() === "AvatarSpeaking") {
      interruptedRef.current = true;
      const handle = playbackRef.current;
      playbackRef.current = null;
      stopAllSpeech(audioElRef);
      if (handle) await handle.fadeOutAndStop(160);
      controllerRef.current.tryTransition("Processing");
    } else if (controllerRef.current.getState() === "Listening") {
      controllerRef.current.tryTransition("Processing");
    } else {
      processingRef.current = false;
      return;
    }

    setConversationState("Processing");
    setUiStatus("thinking");
    micRef.current?.pauseCapture();

    try {
      const stt = await transcribeTherapistSpeech({
        audio: wav,
        locale: host.session.language ?? host.locale,
      });
      void wav;

      if (!stt.ok) {
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        setUiStatus("listening", stt.error);
        micRef.current?.resumeCapture();
        return;
      }

      const transcript = stt.transcript.trim();
      if (!transcript) {
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        setUiStatus("listening");
        micRef.current?.resumeCapture();
        return;
      }

      if (!canSubmitTranscript(guardRef.current, transcript)) {
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        setUiStatus("listening");
        micRef.current?.resumeCapture();
        return;
      }

      guardRef.current = markTurnInFlight(guardRef.current, transcript);

      const turn = await submitConversationTurn({
        sessionId: host.session.id,
        message: transcript,
      });

      if (!turn.ok) {
        guardRef.current = markTurnFailed(guardRef.current);
        if (turn.expired) {
          controllerRef.current.tryTransition("Finished");
          setConversationState("Finished");
          host.onEndSession();
          return;
        }
        setUiStatus("networkRetry", turn.error);
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        micRef.current?.resumeCapture();
        return;
      }

      guardRef.current = markTurnSucceeded(guardRef.current, transcript);
      host.onMessages(turn.data.userMessage, turn.data.assistantMessage);

      metricsRef.current = recordTurn(metricsRef.current, {
        speechDurationMs: meta.durationMs,
        thinkingLatencyMs: 0,
        interrupted: interruptedRef.current,
        vadConfidence: meta.confidence,
      });

      await playAssistant(turn.data.assistantMessage.content);
      flushMetrics();
    } catch {
      guardRef.current = markTurnFailed(guardRef.current);
      setUiStatus("networkRetry");
      setNetworkStatus("reconnecting");
      metricsRef.current = recordNetworkDisconnect(metricsRef.current);
      controllerRef.current.tryTransition("Paused");
      setConversationState("Paused");
      setPaused(true);
      micRef.current?.pauseCapture();
    } finally {
      processingRef.current = false;
    }
  }

  function pause() {
    if (controllerRef.current.isFinished() || endingRef.current) return;
    abortRef.current?.abort();
    stopAllSpeech(audioElRef);
    void playbackRef.current?.fadeOutAndStop(100);
    playbackRef.current = null;
    micRef.current?.pauseCapture();
    micRef.current?.discardBuffer();
    if (controllerRef.current.tryTransition("Paused")) {
      setPaused(true);
      setConversationState("Paused");
      setUiStatus("paused");
      metricsRef.current = recordPause(metricsRef.current);
    }
  }

  function resume() {
    if (!controllerRef.current.isPaused() || endingRef.current) return;
    if (networkRef.current === "offline") {
      setUiStatus("connectionLost");
      return;
    }
    if (controllerRef.current.tryTransition("Listening")) {
      setPaused(false);
      setConversationState("Listening");
      micRef.current?.resumeCapture();
      setUiStatus("listening");
    }
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function toggleAvatarMute() {
    const next = !prefsRef.current.muteAvatar;
    hostRef.current.onPreferencesPatch({ muteAvatar: next });
    if (next) {
      stopAllSpeech(audioElRef);
      void playbackRef.current?.fadeOutAndStop(80);
      playbackRef.current = null;
      if (controllerRef.current.getState() === "AvatarSpeaking") {
        controllerRef.current.tryTransition("Listening");
        setConversationState("Listening");
        setUiStatus("listening");
        micRef.current?.setInterruptMode(false);
        micRef.current?.resumeCapture();
      }
    }
  }

  function repeatLastAnswer() {
    const text = lastAssistantRef.current;
    if (!text || controllerRef.current.isPaused()) return;
    const state = controllerRef.current.getState();
    if (state !== "Listening" && state !== "AvatarSpeaking") return;
    stopAllSpeech(audioElRef);
    void playbackRef.current?.stopImmediate();
    playbackRef.current = null;
    if (state === "AvatarSpeaking") {
      controllerRef.current.tryTransition("Processing");
    } else {
      controllerRef.current.tryTransition("Processing");
    }
    setConversationState("Processing");
    void playAssistant(text);
  }

  const actionsRef = useRef({
    pause,
    resume,
    toggleAvatarMute,
    repeatLastAnswer,
    handleUtterance,
    flushMetrics,
  });
  useEffect(() => {
    actionsRef.current = {
      pause,
      resume,
      toggleAvatarMute,
      repeatLastAnswer,
      handleUtterance,
      flushMetrics,
    };
  });

  // Start / stop continuous mic when enabled
  useEffect(() => {
    if (!enabled || ending) return;
    let cancelled = false;

    void (async () => {
      try {
        const mic = await startContinuousMic(
          {
            onFrame: (_a, wave) => {
              setWaveSamples((prev) => {
                const next = [...prev, wave];
                return next.length > 32 ? next.slice(-32) : next;
              });
            },
            onVadEvent: (ev) => {
              if (ev.type === "interruption") {
                void playbackRef.current?.fadeOutAndStop(120);
              }
            },
            onUtterance: (wav, meta) => {
              void actionsRef.current.handleUtterance(wav, meta);
            },
          },
          {
            minSilenceMs: prefsRef.current.minSilenceMs,
            sensitivity: prefsRef.current.voiceSensitivity,
          },
        );
        if (cancelled) {
          mic.stop();
          return;
        }
        micRef.current = mic;
        queueMicrotask(() => {
          if (cancelled) return;
          setStarted(true);
          setStatusKind("listening");
          setConversationState("Listening");
        });
      } catch {
        queueMicrotask(() => {
          if (!cancelled) setStatusKind("microphoneMuted");
        });
      }
    })();

    return () => {
      cancelled = true;
      micRef.current?.stop();
      micRef.current = null;
      stopAllSpeech(audioElRef);
      abortRef.current?.abort();
      actionsRef.current.flushMetrics();
    };
  }, [enabled, ending]);

  // Sync VAD config when prefs change
  useEffect(() => {
    micRef.current?.updateVadConfig({
      minSilenceMs: preferences.minSilenceMs,
      sensitivity: preferences.voiceSensitivity,
    });
  }, [preferences.minSilenceMs, preferences.voiceSensitivity]);

  // Network online/offline → auto pause / resume
  useEffect(() => {
    if (!enabled) return;
    const onOffline = () => {
      setNetworkStatus("offline");
      setStatusKind("connectionLost");
      metricsRef.current = recordNetworkDisconnect(metricsRef.current);
      if (!controllerRef.current.isPaused()) {
        abortRef.current?.abort();
        stopAllSpeech(audioElRef);
        void playbackRef.current?.stopImmediate();
        playbackRef.current = null;
        micRef.current?.pauseCapture();
        micRef.current?.discardBuffer();
        controllerRef.current.tryTransition("Paused");
        setConversationState("Paused");
        setPaused(true);
        metricsRef.current = recordPause(metricsRef.current);
      }
    };
    const onOnline = () => {
      setNetworkStatus("reconnecting");
      setStatusKind("networkRetry");
      window.setTimeout(() => {
        setNetworkStatus("online");
        if (controllerRef.current.isPaused() && !endingRef.current) {
          controllerRef.current.tryTransition("Listening");
          setConversationState("Listening");
          setPaused(false);
          micRef.current?.resumeCapture();
          setStatusKind("listening");
        }
      }, 400);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (controllerRef.current.isPaused()) actionsRef.current.resume();
        else actionsRef.current.pause();
      } else if (e.key === "Escape") {
        hostRef.current.onConfirmEnd();
      } else if (e.key === "m" || e.key === "M") {
        actionsRef.current.toggleAvatarMute();
      } else if (e.key === "r" || e.key === "R") {
        actionsRef.current.repeatLastAnswer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return {
    statusKind,
    conversationState,
    waveSamples,
    privateNotes,
    setPrivateNotes,
    showPrivateNotes,
    setShowPrivateNotes,
    paused,
    avatarMuted: preferences.muteAvatar,
    networkStatus,
    pause,
    resume,
    togglePause,
    toggleAvatarMute,
    repeatLastAnswer,
    remainingOverride,
    started,
  };
}
