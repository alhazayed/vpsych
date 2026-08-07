/**
 * Clinical Intelligence runtime layer (Stage 6).
 *
 * Composes Case / Emotion / Adaptation / CBE / HPE / LTM — does not replace them.
 */

export * from "@/lib/clinical-intelligence/types";
export * from "@/lib/clinical-intelligence/clamp";
export * from "@/lib/clinical-intelligence/validation";
export * from "@/lib/clinical-intelligence/serialize";
export * from "@/lib/clinical-intelligence/package-seeds";
export * from "@/lib/clinical-intelligence/protectives";
export * from "@/lib/clinical-intelligence/formulation";
export * from "@/lib/clinical-intelligence/therapy-response";
export * from "@/lib/clinical-intelligence/decision";
export * from "@/lib/clinical-intelligence/behavior";
export * from "@/lib/clinical-intelligence/alliance";
export * from "@/lib/clinical-intelligence/recovery";
export * from "@/lib/clinical-intelligence/mind-state";
export * from "@/lib/clinical-intelligence/promote";
export * from "@/lib/clinical-intelligence/format-for-prompt";
export {
  loadDyadClinicalCarry,
  resolveAdaptationForSession,
  type DyadCarryResult,
} from "@/lib/clinical-intelligence/longitudinal";
