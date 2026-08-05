import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  PMFI_VERSION,
  PMFI_WEIGHT_MATRIX,
  buildPmfiDashboard,
  computePatientMindFidelityIndex,
  listPmfiHistory,
  recordPmfiHistory,
} from "@/lib/pmfi";
import {
  createInitialMindState,
  processTherapistTurn,
  PME_VERSION,
} from "@/lib/pme";

export const dynamic = "force-dynamic";

/** GET — PMFI dashboard (Mission 21). */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.pmfi.dashboard",
    resourceType: "patient_mind_fidelity",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-pmfi:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let records = listPmfiHistory(2000);
  if (!records.length) {
    // Offline calibration sample
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "mdd-recurrent-moderate",
      category: "mood",
    });
    mind = processTherapistTurn(
      mind,
      "That sounds really hard. Tell me more.",
      { turnIndex: 1 },
    ).mind;
    const pmfi = computePatientMindFidelityIndex({
      mind,
      expressionLayerWired: true,
      persisted: true,
    });
    recordPmfiHistory({
      overall: pmfi.overall,
      disorder_slug: "mdd-recurrent-moderate",
      computed_at: pmfi.versions.computed_at,
      pmfi,
    });
    records = listPmfiHistory(2000);
  }

  return NextResponse.json({
    pmfi_version: PMFI_VERSION,
    pme_version: PME_VERSION,
    weight_matrix: PMFI_WEIGHT_MATRIX,
    dashboard: buildPmfiDashboard(records),
  });
}

/**
 * POST — score a mind trajectory from messages (Mission 22 prep).
 * Body: { disorder_slug, messages: [{role,content}], category? }
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.pmfi.compute",
    resourceType: "patient_mind_fidelity",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-pmfi-post:${auth.user.id}`,
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
    messages?: Array<{ role: string; content: string }>;
  };

  if (!body.disorder_slug || !body.messages?.length) {
    return NextResponse.json(
      { error: "disorder_slug and messages required" },
      { status: 400 },
    );
  }

  let mind = createInitialMindState({
    snapshot: null,
    disorderSlug: body.disorder_slug,
    category: body.category ?? null,
  });
  let ti = 0;
  for (const msg of body.messages) {
    if (msg.role !== "user") continue;
    ti += 1;
    mind = processTherapistTurn(mind, msg.content, { turnIndex: ti }).mind;
  }

  const pmfi = computePatientMindFidelityIndex({
    mind,
    expressionLayerWired: true,
    persisted: false,
  });
  recordPmfiHistory({
    overall: pmfi.overall,
    disorder_slug: body.disorder_slug,
    computed_at: pmfi.versions.computed_at,
    pmfi,
  });

  return NextResponse.json({
    pmfi_version: PMFI_VERSION,
    pme_version: PME_VERSION,
    mind_summary: {
      phase: mind.therapy.phase,
      trust: mind.relationship.trust,
      alliance: mind.relationship.alliance,
      defenses: mind.current_defenses,
      disclosure: mind.disclosure.map((d) => ({
        topic: d.topic,
        readiness: d.readiness,
        level: d.last_level,
      })),
    },
    pmfi,
  });
}
