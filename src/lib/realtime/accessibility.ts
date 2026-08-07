/**
 * Accessibility controls for realtime sessions.
 */

import type { AccessibilityControls } from "@/lib/realtime/types";

export const DEFAULT_ACCESSIBILITY: AccessibilityControls = {
  captions: true,
  transcriptMode: false,
  keyboardShortcuts: true,
  screenReaderAnnouncements: true,
  volumeNormalization: true,
  speechSpeedScale: 1,
};

export function createAccessibilityControls(
  overrides: Partial<AccessibilityControls> = {},
): AccessibilityControls {
  return {
    ...DEFAULT_ACCESSIBILITY,
    ...overrides,
    speechSpeedScale: clampSpeed(
      overrides.speechSpeedScale ?? DEFAULT_ACCESSIBILITY.speechSpeedScale,
    ),
  };
}

export function clampSpeed(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(1.75, Math.max(0.6, scale));
}

/** Keyboard shortcut map — presentation only. */
export const REALTIME_KEYBOARD_SHORTCUTS = {
  toggleMute: "KeyM",
  toggleCaptions: "KeyC",
  toggleTranscript: "KeyT",
  pauseResume: "Space",
  emergencyEnd: "Escape",
  volumeUp: "Equal",
  volumeDown: "Minus",
  speechFaster: "BracketRight",
  speechSlower: "BracketLeft",
} as const;

export function announceForScreenReader(
  enabled: boolean,
  message: string,
): string | null {
  if (!enabled) return null;
  const trimmed = message.trim();
  return trimmed || null;
}
