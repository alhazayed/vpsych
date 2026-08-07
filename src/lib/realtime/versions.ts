/**
 * Stage 11 version locks and ownership invariants.
 */

import {
  REALTIME_AVATAR_VERSION,
  REALTIME_STREAMING_VERSION,
  REALTIME_VERSION,
  REALTIME_VOICE_GATEWAY_VERSION,
  type RealtimeVersionLock,
} from "@/lib/realtime/types";

export {
  REALTIME_VERSION,
  REALTIME_VOICE_GATEWAY_VERSION,
  REALTIME_AVATAR_VERSION,
  REALTIME_STREAMING_VERSION,
};

/** Forbidden write targets — architecture tests assert these strings stay present. */
export const REALTIME_FORBIDDEN_WRITES = [
  "clinical_snapshot",
  "case_memory",
  "patient_long_term_memory",
  "DecisionPlan",
  "patient prompt",
  "Emotion",
  "Adaptation",
  "Case Engine",
  "Clinical Intelligence",
  "Validation",
  "Supervisor patient writes",
  "Enterprise patient writes",
] as const;

export const REALTIME_OWNERSHIP_RULE =
  "Realtime owns voice gateway, streaming audio, avatar presentation, multilingual media UX, session experience chrome, and realtime observability. Presentation layer only. Never owns Patient, Memory, Emotion, Adaptation, Case Engine, Clinical Intelligence, Validation, Supervisor, or Enterprise tenancy. Never changes patient cognition. Voice and avatar never mutate ClinicalCore.";

export function buildRealtimeVersionLock(opts?: {
  computed_at?: string;
}): RealtimeVersionLock {
  return {
    realtime_version: REALTIME_VERSION,
    voice_gateway_version: REALTIME_VOICE_GATEWAY_VERSION,
    avatar_version: REALTIME_AVATAR_VERSION,
    streaming_version: REALTIME_STREAMING_VERSION,
    computed_at: opts?.computed_at ?? new Date().toISOString(),
  };
}
