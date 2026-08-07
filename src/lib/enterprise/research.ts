/**
 * Multi-center research scaffolding — Stage 10.
 * IRB tagging · dataset keys · export manifests.
 * Does not replace Stage 8 Validation ownership of scientific metrics.
 */

import type { ResearchStudy } from "@/lib/enterprise/types";

export function createResearchStudy(input: {
  id?: string;
  slug: string;
  title: string;
  lead_organization_id: string;
  participating_organization_ids?: string[];
  irb_tag?: string | null;
}): ResearchStudy {
  const participants = new Set([
    input.lead_organization_id,
    ...(input.participating_organization_ids ?? []),
  ]);
  return {
    id: input.id ?? `study_${input.slug}`,
    slug: input.slug,
    title: input.title,
    lead_organization_id: input.lead_organization_id,
    participating_organization_ids: [...participants],
    irb_tag: input.irb_tag ?? null,
    status: "draft",
    dataset_keys: [],
  };
}

export function activateStudy(study: ResearchStudy): ResearchStudy {
  if (!study.irb_tag) {
    throw new Error("IRB tag required before activation");
  }
  return { ...study, status: "active" };
}

export function addParticipatingOrg(
  study: ResearchStudy,
  organizationId: string,
): ResearchStudy {
  if (study.participating_organization_ids.includes(organizationId)) {
    return study;
  }
  return {
    ...study,
    participating_organization_ids: [
      ...study.participating_organization_ids,
      organizationId,
    ],
  };
}

export function registerDatasetKey(
  study: ResearchStudy,
  key: string,
): ResearchStudy {
  if (study.dataset_keys.includes(key)) return study;
  return { ...study, dataset_keys: [...study.dataset_keys, key] };
}

export function buildExportManifest(study: ResearchStudy): {
  study_id: string;
  irb_tag: string | null;
  organizations: string[];
  dataset_keys: string[];
  redaction: string;
  note: string;
} {
  return {
    study_id: study.id,
    irb_tag: study.irb_tag,
    organizations: study.participating_organization_ids,
    dataset_keys: study.dataset_keys,
    redaction: "strip_pii_and_institution_display_names",
    note: "Export is observational. Does not include patient prompt internals or therapist-private notes.",
  };
}

export function canOrgAccessStudy(
  study: ResearchStudy,
  organizationId: string,
): boolean {
  return study.participating_organization_ids.includes(organizationId);
}
