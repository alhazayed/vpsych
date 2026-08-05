/**
 * Extensible metric registry for VQI (future metrics without schema redesign).
 */

import { CFI_VERSION } from "@/lib/cfi/weights";
import { ERI_VERSION } from "@/lib/eri/weights";
import { AVI_VERSION } from "@/lib/avi/weights";
import { ALE_VERSION } from "@/lib/ale/weights";
import { RRS_VERSION } from "@/lib/rrs/weights";
import { HCFI_VERSION } from "@/lib/hcfi/weights";
import { PMFI_VERSION } from "@/lib/pmfi/weights";
import {
  LAS_VERSION,
  PAS_VERSION,
  PAB_VERSION,
} from "@/lib/validation/types";
import type { VqiMetricId } from "@/lib/vqi/weights";

export type MetricDefinition = {
  id: VqiMetricId;
  name: string;
  description: string;
  version: string;
  domain:
    | "clinical"
    | "educational"
    | "assessment"
    | "adaptive"
    | "research"
    | "technical"
    | "custom";
  enabled: boolean;
};

const REGISTRY: MetricDefinition[] = [
  {
    id: "CFI",
    name: "Clinical Fidelity Index",
    description: "How faithfully AI patients reproduce intended disorders",
    version: CFI_VERSION,
    domain: "clinical",
    enabled: true,
  },
  {
    id: "ERI",
    name: "Educational Reliability Index",
    description: "Reliability and educational usefulness of AI assessments",
    version: ERI_VERSION,
    domain: "educational",
    enabled: true,
  },
  {
    id: "AVI",
    name: "Assessment Validity Index",
    description: "Whether VPsych evaluates the competencies it claims",
    version: AVI_VERSION,
    domain: "assessment",
    enabled: true,
  },
  {
    id: "ALE",
    name: "Adaptive Learning Effectiveness",
    description: "Whether adaptive curriculum selects appropriate experiences",
    version: ALE_VERSION,
    domain: "adaptive",
    enabled: true,
  },
  {
    id: "RRS",
    name: "Research Readiness Score",
    description: "Whether platform data can support research and publication",
    version: RRS_VERSION,
    domain: "research",
    enabled: true,
  },
  {
    id: "HCFI",
    name: "Human Conversation Fidelity Index",
    description:
      "How indistinguishable AI patient dialogue is from a skilled standardized patient",
    version: HCFI_VERSION,
    domain: "clinical",
    enabled: true,
  },
  {
    id: "PMFI",
    name: "Patient Mind Fidelity Index",
    description:
      "Whether patient psychology is owned by the Patient Mind Engine with consistent dynamics",
    version: PMFI_VERSION,
    domain: "clinical",
    enabled: true,
  },
  {
    id: "PAS",
    name: "Psychiatrist Authenticity Score",
    description: "Blinded clinician authenticity ratings (Mission 22)",
    version: PAS_VERSION,
    domain: "clinical",
    enabled: true,
  },
  {
    id: "LAS",
    name: "Learner Authenticity Score",
    description: "Learner immersion and educational authenticity (Mission 22)",
    version: LAS_VERSION,
    domain: "educational",
    enabled: true,
  },
  {
    id: "PAB",
    name: "Patient Authenticity Benchmark",
    description: "PME vs SP / human / legacy comparator benchmark",
    version: PAB_VERSION,
    domain: "research",
    enabled: true,
  },
];

/** In-memory extension point for future metrics (no schema redesign). */
const custom: MetricDefinition[] = [];

export function listMetricDefinitions(): MetricDefinition[] {
  return [...REGISTRY, ...custom].filter((m) => m.enabled);
}

export function getMetricDefinition(
  id: VqiMetricId,
): MetricDefinition | undefined {
  return listMetricDefinitions().find((m) => m.id === id);
}

export function registerMetricDefinition(def: MetricDefinition): void {
  const idx = custom.findIndex((m) => m.id === def.id);
  if (idx >= 0) custom[idx] = def;
  else custom.push(def);
}

export function metricVersions(): Record<string, string> {
  return Object.fromEntries(
    listMetricDefinitions().map((m) => [m.id, m.version]),
  );
}
