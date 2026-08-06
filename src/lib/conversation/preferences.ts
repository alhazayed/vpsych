import {
  DEFAULT_VOICE_PREFERENCES,
  type VoiceConversationPreferences,
} from "@/lib/conversation/types";
import { clampSilenceMs } from "@/lib/conversation/vad";

const STORAGE_KEY = "vpsych.hfte.preferences";

export function normalizeVoicePreferences(
  input: unknown,
): VoiceConversationPreferences {
  const base = { ...DEFAULT_VOICE_PREFERENCES };
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;

  if (raw.mode === "push_to_talk" || raw.mode === "hands_free") {
    base.mode = raw.mode;
  }
  if (typeof raw.autoInterrupt === "boolean") {
    base.autoInterrupt = raw.autoInterrupt;
  }
  if (typeof raw.thinkingDelayScale === "number") {
    base.thinkingDelayScale = Math.min(
      2,
      Math.max(0.5, raw.thinkingDelayScale),
    );
  }
  if (typeof raw.showWaveform === "boolean") {
    base.showWaveform = raw.showWaveform;
  }
  if (typeof raw.voiceSensitivity === "number") {
    base.voiceSensitivity = Math.min(1, Math.max(0, raw.voiceSensitivity));
  }
  if (typeof raw.minSilenceMs === "number") {
    base.minSilenceMs = clampSilenceMs(raw.minSilenceMs);
  }
  if (typeof raw.freezeTimerWhenPaused === "boolean") {
    base.freezeTimerWhenPaused = raw.freezeTimerWhenPaused;
  }
  if (typeof raw.muteAvatar === "boolean") {
    base.muteAvatar = raw.muteAvatar;
  }
  return base;
}

export function loadLocalVoicePreferences(): VoiceConversationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_PREFERENCES };
    return normalizeVoicePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VOICE_PREFERENCES };
  }
}

export function saveLocalVoicePreferences(
  prefs: VoiceConversationPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeVoicePreferences(prefs)),
    );
  } catch {
    /* quota / private mode */
  }
}

export function mergeVoicePreferences(
  current: VoiceConversationPreferences,
  patch: Partial<VoiceConversationPreferences>,
): VoiceConversationPreferences {
  return normalizeVoicePreferences({ ...current, ...patch });
}
