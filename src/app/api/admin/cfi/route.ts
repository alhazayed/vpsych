import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { BUILTIN_DISORDERS, DISORDER_IDS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import {
  buildCfiDashboard,
  computeClinicalFidelityIndex,
  cfiInputFromSnapshot,
  CFI_VERSION,
  CFI_WEIGHT_MATRIX,
  type StoredCfiRecord,
} from "@/lib/cfi";

export const dynamic = "force-dynamic";

const demoPersona: PersonaRow = {
  id: "persona-cfi",
  avatar_id: "avatar-cfi",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

/**
 * GET — Clinical Fidelity Dashboard (DB rows + offline corpus fallback).
 * POST — compute CFI corpus across builtins × locales and optionally persist.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cfi.dashboard",
    resourceType: "clinical_fidelity_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-cfi:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("clinical_fidelity_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let records: StoredCfiRecord[] = [];
  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      disorder_slug: String(row.disorder_slug),
      locale: String(row.locale),
      computed_at: String(row.created_at),
      cfi: {
        overall: Number(row.overall),
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        evidence: (row.evidence as never) ?? {
          disorder_slug: row.disorder_slug,
          locale: row.locale,
          severity: null,
          dsm5_code: null,
          icd11_code: null,
          dimensions: {},
        },
        clinical_reasoning: String(row.clinical_reasoning ?? ""),
        recommendations: (row.recommendations as string[]) ?? [],
        versions: (row.versions as never) ?? {
          cfi_version: CFI_VERSION,
          prompt_version: null,
          model_version: null,
          persona_version: null,
          clinical_template_version: null,
          assessment_schema_version: null,
          disorder_package_version: null,
          computed_at: row.created_at,
        },
        weight_matrix_version: String(row.weight_matrix_version ?? CFI_VERSION),
      },
    }));
  } else {
    // Offline corpus: generate CaseInstances and score CFI
    records = buildOfflineCorpus();
  }

  const dashboard = buildCfiDashboard(records);
  return NextResponse.json({
    dashboard,
    weight_matrix: CFI_WEIGHT_MATRIX,
    cfi_version: CFI_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cfi.compute",
    resourceType: "clinical_fidelity_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-cfi:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let persist = false;
  try {
    const body = (await request.json()) as { persist?: boolean };
    persist = Boolean(body.persist);
  } catch {
    /* empty body ok */
  }

  const records = buildOfflineCorpus();
  const inserted: string[] = [];

  if (persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("clinical_fidelity_scores")
        .insert({
          assessment_id: r.cfi.evidence.disorder_slug,
          disorder_slug: r.disorder_slug,
          locale: r.locale,
          overall: r.overall,
          ci_lower: r.cfi.confidence_interval.lower,
          ci_upper: r.cfi.confidence_interval.upper,
          cfi_version: CFI_VERSION,
          weight_matrix_version: CFI_VERSION,
          prompt_version: r.cfi.versions.prompt_version,
          model_version: r.cfi.versions.model_version,
          persona_version: r.cfi.versions.persona_version,
          clinical_template_version: r.cfi.versions.clinical_template_version
            ? String(r.cfi.versions.clinical_template_version)
            : null,
          assessment_schema_version: r.cfi.versions.assessment_schema_version,
          disorder_package_version: r.cfi.versions.disorder_package_version,
          subscores: r.cfi.subscores,
          evidence: r.cfi.evidence,
          clinical_reasoning: r.cfi.clinical_reasoning,
          recommendations: r.cfi.recommendations,
          versions: r.cfi.versions,
        })
        .select("id")
        .maybeSingle();
      if (!error && data?.id) inserted.push(data.id);
    }
  }

  return NextResponse.json({
    ok: true,
    computed: records.length,
    persisted: inserted.length,
    dashboard: buildCfiDashboard(records),
    sample: records[0]?.cfi ?? null,
  });
}

function buildOfflineCorpus(): StoredCfiRecord[] {
  const locales = ["en-US", "ar-JO"] as const;
  const difficulties = ["beginner", "intermediate", "advanced"] as const;
  const records: StoredCfiRecord[] = [];
  let i = 0;
  for (const disorder of BUILTIN_DISORDERS) {
    for (const locale of locales) {
      const difficulty = difficulties[i % difficulties.length]!;
      i += 1;
      const age = Math.min(
        disorder.max_age ?? 40,
        Math.max(disorder.min_age ?? 18, 28),
      );
      const gen = generateCaseInstance({
        persona: {
          ...demoPersona,
          identity: {
            age,
            gender: (disorder.allowed_genders[0] as "female") || "female",
          },
        },
        avatarId: "avatar-cfi",
        primaryDisorder: disorder,
        difficulty,
        therapyModality: "cbt",
        locale,
        seed: `cfi-${disorder.slug}-${locale}-${difficulty}`,
      });
      if (!gen.ok) continue;
      const cfi =
        (gen.snapshot.clinical_fidelity as never) ??
        computeClinicalFidelityIndex(
          cfiInputFromSnapshot(gen.snapshot, disorder),
        );
      const overall =
        typeof (cfi as { overall?: number }).overall === "number"
          ? (cfi as { overall: number }).overall
          : computeClinicalFidelityIndex(
              cfiInputFromSnapshot(gen.snapshot, disorder),
            ).overall;
      const full =
        "subscores" in (cfi as object)
          ? (cfi as ReturnType<typeof computeClinicalFidelityIndex>)
          : computeClinicalFidelityIndex(
              cfiInputFromSnapshot(gen.snapshot, disorder),
            );
      records.push({
        overall,
        disorder_slug: disorder.slug,
        locale,
        computed_at: gen.snapshot.generated_at,
        cfi: full,
      });
    }
  }
  return records;
}
