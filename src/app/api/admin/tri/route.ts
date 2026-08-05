import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import {
  TRE_VERSION,
  TRI_VERSION,
  buildTriDashboard,
  clearTriHistory,
  computeTherapyResponseIndex,
  listTriHistory,
  normalizeModality,
  recordTriHistory,
  seedTriOfflineSample,
  simulateTreatmentCourse,
  type TreModality,
} from "@/lib/tre";

export const dynamic = "force-dynamic";

/** GET — Therapy Response Index dashboard (Excellence Program 1). */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.tri.dashboard",
    resourceType: "therapy_response_index",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-tri:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let records = listTriHistory(2000);
  if (!records.length) {
    seedTriOfflineSample(
      simulateTreatmentCourse,
      computeTherapyResponseIndex,
      recordTriHistory,
    );
    records = listTriHistory(2000);
  }

  return NextResponse.json({
    tre_version: TRE_VERSION,
    tri_version: TRI_VERSION,
    dashboard: buildTriDashboard(records),
    modalities: [
      "supportive",
      "cbt",
      "dbt",
      "motivational_interviewing",
      "act",
      "psychodynamic",
      "family_psychoeducation",
      "crisis_intervention",
    ],
  });
}

/**
 * POST — simulate a treatment course and score TRI.
 * Body: { disorder_slug, modality?, sessions?, competence?, alliance?, medication_adherence?, category? }
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.tri.compute",
    resourceType: "therapy_response_index",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-tri-post:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    disorder_slug?: string;
    category?: string;
    modality?: string;
    sessions?: number;
    competence?: number;
    alliance?: number;
    medication_adherence?: number;
    reset_history?: boolean;
    run_all_disorders?: boolean;
  };

  if (body.reset_history) clearTriHistory();

  if (body.run_all_disorders) {
    const modality = normalizeModality(body.modality ?? "cbt");
    const results = BUILTIN_DISORDERS.filter((d) => d.is_active).map((d) => {
      const { treatment, trajectory } = simulateTreatmentCourse({
        modality,
        disorder_slug: d.slug,
        category: d.category,
        sessions: body.sessions ?? 6,
        competence: body.competence ?? 78,
        alliance: body.alliance ?? 72,
        medication_adherence: body.medication_adherence ?? 75,
      });
      const tri = computeTherapyResponseIndex(treatment);
      recordTriHistory({
        overall: tri.overall,
        disorder_slug: d.slug,
        modality,
        tri,
      });
      return {
        disorder_slug: d.slug,
        category: d.category,
        trajectory,
        tri_overall: tri.overall,
        symptom_end: treatment.outcomes.symptoms,
      };
    });
    return NextResponse.json({
      tre_version: TRE_VERSION,
      tri_version: TRI_VERSION,
      results,
      dashboard: buildTriDashboard(),
    });
  }

  if (!body.disorder_slug) {
    return NextResponse.json(
      { error: "disorder_slug required (or run_all_disorders: true)" },
      { status: 400 },
    );
  }

  const modality = normalizeModality(body.modality ?? "cbt") as TreModality;
  const { treatment, trajectory } = simulateTreatmentCourse({
    modality,
    disorder_slug: body.disorder_slug,
    category: body.category,
    sessions: Math.min(20, Math.max(1, body.sessions ?? 6)),
    competence: body.competence ?? 75,
    alliance: body.alliance ?? 70,
    medication_adherence: body.medication_adherence ?? 75,
  });
  const tri = computeTherapyResponseIndex(treatment);
  recordTriHistory({
    overall: tri.overall,
    disorder_slug: body.disorder_slug,
    modality,
    tri,
  });

  return NextResponse.json({
    tre_version: TRE_VERSION,
    tri_version: TRI_VERSION,
    trajectory,
    treatment_summary: {
      sessions: treatment.sessions.length,
      outcomes: treatment.outcomes,
      trajectory: treatment.trajectory,
    },
    tri,
  });
}
