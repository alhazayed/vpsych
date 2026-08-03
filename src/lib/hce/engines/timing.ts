/**
 * Timing engine — disorder profiles + trigger delays (Phase A Layer 1).
 */

import {
  computeTurnTiming,
  resolveDisorderTiming,
} from "@/lib/hce/disorder-timing";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { EmotionEngineOutput, TimingEngineOutput } from "@/lib/hce/types";

export function timingTick(
  snapshot: CaseInstanceSnapshot,
  emotion: EmotionEngineOutput,
  turnIndex: number,
): TimingEngineOutput {
  const profile = resolveDisorderTiming(snapshot);
  const triggerDelay = emotion.triggers_fired.length > 0;
  const timing = computeTurnTiming(profile, triggerDelay, turnIndex + 1);
  return {
    pause_before_ms: timing.pause_before_ms,
    speech_rate: timing.speech_rate,
    should_interrupt: timing.should_interrupt,
  };
}
