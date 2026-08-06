/**
 * Automatic VQI recalculation triggers.
 *
 * Call `requestVqiRecalculation` whenever an upstream scientific input changes.
 * The admin API / offline corpus remains the source of truth for full recompute;
 * this module records why a recompute is required for auditability.
 */

export type VqiRecalcTrigger =
  | "assessment_completed"
  | "competency_updated"
  | "adaptive_curriculum_updated"
  | "clinical_template_updated"
  | "instructor_preset_updated"
  | "metric_algorithm_updated"
  | "weight_set_updated"
  | "platform_release_changed";

export type VqiRecalcRequest = {
  trigger: VqiRecalcTrigger;
  entity_type?: string;
  entity_id?: string;
  at: string;
  notes?: string;
};

const pending: VqiRecalcRequest[] = [];

export function requestVqiRecalculation(
  trigger: VqiRecalcTrigger,
  opts?: Omit<VqiRecalcRequest, "trigger" | "at">,
): VqiRecalcRequest {
  const req: VqiRecalcRequest = {
    trigger,
    entity_type: opts?.entity_type,
    entity_id: opts?.entity_id,
    notes: opts?.notes,
    at: new Date().toISOString(),
  };
  pending.push(req);
  return req;
}

export function drainVqiRecalculationQueue(): VqiRecalcRequest[] {
  return pending.splice(0, pending.length);
}

export function peekVqiRecalculationQueue(): readonly VqiRecalcRequest[] {
  return pending;
}
