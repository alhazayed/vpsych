/**
 * Case Engine comorbidity compatibility — read helpers over the authored
 * `BUILTIN_COMORBIDITY_RULES` matrix. Does not invent clinical combinations.
 */

import {
  BUILTIN_COMORBIDITY_RULES,
  BUILTIN_DISORDERS,
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import type { ComorbidityRule, DisorderRow } from "@/lib/case-engine/types";
import { findComorbidityRule } from "@/lib/case-engine/validation";

export type ComorbidityCompatStatus =
  | "compatible"
  | "possible"
  | "rare"
  | "impossible"
  | "unlisted"
  | "same_as_primary"
  | "unknown_disorder";

export type ComorbidityCompatResult = {
  status: ComorbidityCompatStatus;
  /** True when Case Engine will accept the pair for generation. */
  previewAllowed: boolean;
  /** Authored rule when present. */
  rule: ComorbidityRule | null;
  primary: DisorderRow | null;
  comorbid: DisorderRow | null;
  /** Stable machine code for UI/API mapping. */
  code:
    | "ok"
    | "comorbidity_unlisted"
    | "comorbidity_incompatible"
    | "comorbidity_duplicate_primary"
    | "unknown_disorder";
};

/**
 * Resolve authored compatibility for a primary + comorbidity slug pair.
 * Unlisted pairs are NOT treated as clinically supported — they need authoring.
 */
export function getComorbidityCompatibility(
  primarySlug: string,
  comorbidSlug: string | null | undefined,
  catalog = getBuiltinCatalog(),
): ComorbidityCompatResult {
  const primary = findDisorderBySlug(primarySlug, catalog);
  if (!primary) {
    return {
      status: "unknown_disorder",
      previewAllowed: false,
      rule: null,
      primary: null,
      comorbid: null,
      code: "unknown_disorder",
    };
  }
  if (!comorbidSlug) {
    return {
      status: "compatible",
      previewAllowed: true,
      rule: null,
      primary,
      comorbid: null,
      code: "ok",
    };
  }
  const comorbid = findDisorderBySlug(comorbidSlug, catalog);
  if (!comorbid) {
    return {
      status: "unknown_disorder",
      previewAllowed: false,
      rule: null,
      primary,
      comorbid: null,
      code: "unknown_disorder",
    };
  }
  if (comorbid.id === primary.id || comorbid.slug === primary.slug) {
    return {
      status: "same_as_primary",
      previewAllowed: false,
      rule: null,
      primary,
      comorbid,
      code: "comorbidity_duplicate_primary",
    };
  }
  const rule =
    findComorbidityRule(primary.id, comorbid.id, catalog.comorbidityRules) ??
    null;
  if (!rule) {
    return {
      status: "unlisted",
      previewAllowed: false,
      rule: null,
      primary,
      comorbid,
      code: "comorbidity_unlisted",
    };
  }
  if (!rule.compatible || rule.tier === "impossible") {
    return {
      status: "impossible",
      previewAllowed: false,
      rule,
      primary,
      comorbid,
      code: "comorbidity_incompatible",
    };
  }
  const status: ComorbidityCompatStatus =
    rule.tier === "possible" || rule.tier === "rare" ? rule.tier : "compatible";
  return {
    status,
    previewAllowed: true,
    rule,
    primary,
    comorbid,
    code: "ok",
  };
}

/** Active authored comorbidities that Case Engine will accept for a primary. */
export function listCompatibleComorbiditySlugs(
  primarySlug: string,
  catalog = getBuiltinCatalog(),
): string[] {
  const primary = findDisorderBySlug(primarySlug, catalog);
  if (!primary) return [];
  const byId = new Map(catalog.disorders.map((d) => [d.id, d]));
  const out: string[] = [];
  for (const rule of catalog.comorbidityRules) {
    if (rule.primary_disorder_id !== primary.id) continue;
    if (!rule.compatible || rule.tier === "impossible") continue;
    const comorbid = byId.get(rule.comorbid_disorder_id);
    if (comorbid?.is_active) out.push(comorbid.slug);
  }
  return out.sort();
}

export type CompatMatrixRow = {
  primary: string;
  comorbid: string;
  status: ComorbidityCompatStatus;
  previewAllowed: boolean;
  code: ComorbidityCompatResult["code"];
  tier: ComorbidityRule["tier"] | null;
  notes: string | null;
};

/**
 * Full active×active audit of UI-selectable pairs vs authored rules.
 * UI historically offered every active disorder except primary.
 */
export function auditComorbidityCompatibilityMatrix(
  catalog = getBuiltinCatalog(),
): {
  activeSlugs: string[];
  reservedSlugs: string[];
  authoredRules: Array<{
    primary: string;
    comorbid: string;
    compatible: boolean;
    tier: ComorbidityRule["tier"];
    notes: string | null;
  }>;
  orphanRules: Array<{ primaryId: string; comorbidId: string }>;
  duplicateRuleKeys: string[];
  uiSelectableSupported: CompatMatrixRow[];
  uiSelectableUnsupported: CompatMatrixRow[];
  uiSelectableImpossible: CompatMatrixRow[];
} {
  const byId = new Map(catalog.disorders.map((d) => [d.id, d]));
  const active = catalog.disorders.filter((d) => d.is_active);
  const reserved = catalog.disorders.filter((d) => !d.is_active);

  const authoredRules = catalog.comorbidityRules.map((r) => ({
    primary: byId.get(r.primary_disorder_id)?.slug ?? r.primary_disorder_id,
    comorbid: byId.get(r.comorbid_disorder_id)?.slug ?? r.comorbid_disorder_id,
    compatible: r.compatible,
    tier: r.tier,
    notes: r.notes ?? null,
  }));

  const orphanRules = catalog.comorbidityRules
    .filter(
      (r) =>
        !byId.has(r.primary_disorder_id) || !byId.has(r.comorbid_disorder_id),
    )
    .map((r) => ({
      primaryId: r.primary_disorder_id,
      comorbidId: r.comorbid_disorder_id,
    }));

  const keyCounts = new Map<string, number>();
  for (const r of catalog.comorbidityRules) {
    const k = `${r.primary_disorder_id}|${r.comorbid_disorder_id}`;
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
  const duplicateRuleKeys = [...keyCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([k]) => k);

  const uiSelectableSupported: CompatMatrixRow[] = [];
  const uiSelectableUnsupported: CompatMatrixRow[] = [];
  const uiSelectableImpossible: CompatMatrixRow[] = [];

  for (const primary of active) {
    for (const comorbid of active) {
      if (primary.slug === comorbid.slug) continue;
      const result = getComorbidityCompatibility(
        primary.slug,
        comorbid.slug,
        catalog,
      );
      const row: CompatMatrixRow = {
        primary: primary.slug,
        comorbid: comorbid.slug,
        status: result.status,
        previewAllowed: result.previewAllowed,
        code: result.code,
        tier: result.rule?.tier ?? null,
        notes: result.rule?.notes ?? null,
      };
      if (result.code === "ok") uiSelectableSupported.push(row);
      else if (result.code === "comorbidity_incompatible") {
        uiSelectableImpossible.push(row);
      } else uiSelectableUnsupported.push(row);
    }
  }

  return {
    activeSlugs: active.map((d) => d.slug).sort(),
    reservedSlugs: reserved.map((d) => d.slug).sort(),
    authoredRules,
    orphanRules,
    duplicateRuleKeys,
    uiSelectableSupported,
    uiSelectableUnsupported,
    uiSelectableImpossible,
  };
}

/** Re-export builtins for tests that assert against the matrix source. */
export const COMORBIDITY_RULE_SOURCE = {
  module: "src/lib/case-engine/catalog.ts",
  exportName: "BUILTIN_COMORBIDITY_RULES",
  ruleCount: BUILTIN_COMORBIDITY_RULES.length,
  disorderCount: BUILTIN_DISORDERS.length,
} as const;
