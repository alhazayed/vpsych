/**
 * VPsych Quality Index (VQI) v1.0 — constants & default weight set.
 *
 * Weights are NOT hardcoded into the engine — they live in versioned WeightSets
 * editable from the Admin Dashboard. Changing weights creates a new weight_version.
 */

export const VQI_VERSION = "1.0.0";
export const VQI_ALGORITHM_VERSION = "1.0.0";
export const DEFAULT_WEIGHT_SET_ID = "default-v1";
export const DEFAULT_WEIGHT_VERSION = "1.0.0";

/** Registered sub-metric ids consumed by VQI (extensible). */
export type VqiMetricId = "CFI" | "ERI" | "AVI" | "ALE" | "RRS" | (string & {});

export type VqiWeightEntry = {
  metric_id: VqiMetricId;
  weight: number;
  rationale: string;
  required?: boolean;
};

export type VqiWeightSet = {
  id: string;
  name: string;
  version: string;
  frozen: boolean;
  algorithm_version: string;
  entries: VqiWeightEntry[];
  created_at: string;
  notes?: string;
};

/** Default scientific board weights (Mission VQI). Sum MUST equal 1.0. */
export const DEFAULT_VQI_WEIGHT_ENTRIES: VqiWeightEntry[] = [
  {
    metric_id: "CFI",
    weight: 0.3,
    rationale: "Clinical fidelity is the primary nosological quality anchor",
    required: true,
  },
  {
    metric_id: "ERI",
    weight: 0.25,
    rationale: "Educational reliability of assessments and feedback",
    required: true,
  },
  {
    metric_id: "AVI",
    weight: 0.2,
    rationale: "Whether assessments measure claimed competencies",
    required: true,
  },
  {
    metric_id: "ALE",
    weight: 0.15,
    rationale: "Adaptive curriculum selects increasingly appropriate experiences",
    required: false,
  },
  {
    metric_id: "RRS",
    weight: 0.1,
    rationale: "Research/publication readiness of data & provenance",
    required: false,
  },
];

export function createDefaultWeightSet(
  overrides?: Partial<VqiWeightSet>,
): VqiWeightSet {
  return {
    id: DEFAULT_WEIGHT_SET_ID,
    name: "Default Scientific Board Weights",
    version: DEFAULT_WEIGHT_VERSION,
    frozen: true,
    algorithm_version: VQI_ALGORITHM_VERSION,
    entries: DEFAULT_VQI_WEIGHT_ENTRIES.map((e) => ({ ...e })),
    created_at: "2026-08-03T00:00:00.000Z",
    notes: "Mission VQI default — CFI 30% / ERI 25% / AVI 20% / ALE 15% / RRS 10%",
    ...overrides,
  };
}

export function assertWeightSetValid(set: VqiWeightSet): void {
  const sum = set.entries.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`VQI weight set ${set.id}@${set.version} sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(set.entries.map((e) => e.metric_id));
  if (ids.size !== set.entries.length) {
    throw new Error(`Duplicate metric ids in VQI weight set ${set.id}`);
  }
  for (const e of set.entries) {
    if (e.weight < 0 || e.weight > 1) {
      throw new Error(`Invalid weight for ${e.metric_id}: ${e.weight}`);
    }
  }
}

assertWeightSetValid(createDefaultWeightSet());
