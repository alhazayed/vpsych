/**
 * HCE runtime configuration and feature flags.
 */

/** HCE runs when clinical snapshot exists and HCE is not explicitly disabled. */
export function isHceEnabledForSession(hasClinicalSnapshot: boolean): boolean {
  const flag = process.env.HCE_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return hasClinicalSnapshot;
  // Default: enable for case-engine sessions only.
  return hasClinicalSnapshot;
}

export const HCE_MAX_EPISODIC = 48;
export const HCE_MAX_FACT_LENGTH = 280;
export const HCE_MAX_UTTERANCE_CHARS = 600;
export const HCE_HISTORY_WINDOW = 20;
export const HCE_MAX_MEMORY_WRITES = 6;

export function hceDeepReasoningEffort(): "low" | "medium" | "high" {
  const v = process.env.HCE_DEEP_REASONING_EFFORT?.trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return "medium";
}
