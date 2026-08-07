/**
 * Avatar Controller — facial / gaze / breath / lip-sync presentation.
 * Consumes NBE cues and emotion hints; never writes ClinicalCore.
 */

import type {
  AvatarExpression,
  AvatarPose,
  NonverbalPresentation,
} from "@/lib/realtime/types";

export type AvatarControllerInput = {
  speaking: boolean;
  streaming: boolean;
  thinking: boolean;
  interrupted: boolean;
  /** Approximate amplitude 0–1 for lip sync. */
  audioLevel?: number;
  /** Emotion / affect label from upstream (read-only). */
  emotionHint?: string | null;
  nonverbal?: Partial<NonverbalPresentation> | null;
  nowMs?: number;
};

const EXPRESSIONS: Record<string, AvatarExpression> = {
  depressed: "sad",
  sad: "sad",
  anxious: "anxious",
  fear: "anxious",
  manic: "engaged",
  psychotic: "tense",
  avoidant: "avoidant",
  warm: "soft_smile",
  neutral: "neutral",
};

export function createAvatarController(seed = 1) {
  let blinkUntil = 0;
  let lastBlinkAt = 0;
  let breathPhase = 0;

  return {
    tick(input: AvatarControllerInput): AvatarPose {
      const now = input.nowMs ?? Date.now();
      breathPhase = (breathPhase + 0.04) % (Math.PI * 2);

      // Blink every ~3–5s with short closure.
      if (now >= blinkUntil && now - lastBlinkAt > 2800 + (seed % 7) * 180) {
        lastBlinkAt = now;
        blinkUntil = now + 120;
      }
      const blink = now < blinkUntil;

      const emotion = (input.emotionHint ?? "neutral").toLowerCase();
      let expression: AvatarExpression =
        EXPRESSIONS[emotion] ?? (input.thinking ? "thinking" : "neutral");
      if (input.speaking || input.streaming) expression = "speaking";
      if (input.interrupted) expression = "tense";

      const eyeContact = clamp01(input.nonverbal?.eyeContact ?? 0.55);
      const avoidance = clamp01(input.nonverbal?.avoidance ?? 0);
      const gazeX = (0.5 - eyeContact) * 0.4 + avoidance * 0.35;
      const gazeY = input.thinking ? -0.08 : 0.02;

      const audio = clamp01(input.audioLevel ?? (input.speaking ? 0.45 : 0));
      const visemeOpen = input.speaking || input.streaming ? audio * 0.85 : 0;

      const headYaw = gazeX * 12;
      const headPitch = (input.thinking ? 4 : 0) + Math.sin(breathPhase) * 0.6;
      const headRoll = Math.sin(breathPhase * 0.5) * 0.4;

      let gesture: AvatarPose["gesture"] = "none";
      if (avoidance > 0.55) gesture = "withdraw";
      else if (expression === "anxious") gesture = "self_soothe";
      else if (expression === "thinking") gesture = "fidget";
      else if (eyeContact > 0.7 && input.speaking) gesture = "open_hand";

      return {
        expression,
        eyeContact: eyeContact * (1 - avoidance * 0.5),
        gazeX,
        gazeY,
        blink,
        breathingPhase: breathPhase,
        headYaw,
        headPitch,
        headRoll,
        gesture,
        speakingIntensity: visemeOpen,
        visemeOpen,
        lipSyncActive: visemeOpen > 0.05,
        idleIntensity: input.speaking ? 0.15 : 0.45,
      };
    },
  };
}

/** Map mouth openness to a simple viseme class for CSS/animation hooks. */
export function visemeClass(open: number): string {
  if (open < 0.05) return "viseme-rest";
  if (open < 0.25) return "viseme-narrow";
  if (open < 0.55) return "viseme-mid";
  return "viseme-open";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
