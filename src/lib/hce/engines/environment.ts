/**
 * Environmental Context — session phase, fatigue, setting stressors.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { EnvironmentEngineOutput, HceMemoryState } from "@/lib/hce/types";

export function environmentTick(
  snapshot: CaseInstanceSnapshot,
  state: HceMemoryState,
  elapsedSeconds: number,
  maxDurationSec: number,
): EnvironmentEngineOutput {
  const ratio = maxDurationSec > 0 ? elapsedSeconds / maxDurationSec : 0;
  let phase: EnvironmentEngineOutput["phase"] = "opening";
  if (ratio > 0.85) phase = "overtime";
  else if (ratio > 0.7) phase = "closing";
  else if (ratio > 0.15) phase = "middle";

  const fatigue = clamp(ratio * 0.7 + state.environment.fatigue * 0.3, 0, 1);
  const stressors: string[] = [];

  const ctx = snapshot.randomized_context;
  if (ctx?.recent_stressor) stressors.push(ctx.recent_stressor);
  if (ctx?.financial_situation) stressors.push(ctx.financial_situation);

  const preset = snapshot.instructor_preset;
  if (preset?.voice_enabled === false) {
    stressors.push("text-only session");
  }

  return {
    fatigue,
    setting: inferSetting(snapshot),
    ambient_stressors: stressors.slice(0, 4),
    time_pressure: ratio > 0.75,
    phase,
  };
}

export function applyEnvironment(
  state: HceMemoryState,
  env: EnvironmentEngineOutput,
): HceMemoryState {
  return {
    ...state,
    environment: {
      fatigue: env.fatigue,
      phase: env.phase,
    },
  };
}

function inferSetting(snapshot: CaseInstanceSnapshot): string {
  const modality = snapshot.therapy_modality;
  return `Outpatient therapy session; modality ${modality}; locale ${snapshot.locale}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
