import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  HCFI_VERSION,
  HCFI_WEIGHT_MATRIX,
  buildHcfiDashboard,
  buildHcfiOfflineCorpus,
  computeHumanConversationFidelityIndex,
  listHcfiHistory,
  recordHcfiHistory,
  type StoredHcfiRecord,
} from "@/lib/hcfi";

export const dynamic = "force-dynamic";

/**
 * GET — Human Conversation Fidelity Index dashboard + history.
 * Query: ?source=history|offline (default: history with offline fallback)
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.hcfi.dashboard",
    resourceType: "human_conversation_fidelity",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-hcfi:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const source = (url.searchParams.get("source") ?? "auto").toLowerCase();

  let records: StoredHcfiRecord[] = listHcfiHistory(2000);
  let resolvedSource: "history" | "offline_corpus" = "history";
  if (source === "offline" || records.length === 0) {
    records = buildHcfiOfflineCorpus();
    resolvedSource = "offline_corpus";
  }

  const dashboard = buildHcfiDashboard(records);
  return NextResponse.json({
    hcfi_version: HCFI_VERSION,
    source: resolvedSource,
    weight_matrix: HCFI_WEIGHT_MATRIX,
    dashboard,
    recent: records.slice(-20).map((r) => ({
      overall: r.overall,
      disorder_slug: r.disorder_slug,
      locale: r.locale,
      computed_at: r.computed_at,
      recommendations: r.hcfi.recommendations.slice(0, 3),
    })),
  });
}

/**
 * POST — score a transcript sample (admin tooling / calibration).
 * Body: { messages, disorder_slug, locale, ...flags }
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.hcfi.compute",
    resourceType: "human_conversation_fidelity",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-hcfi-post:${auth.user.id}`,
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
    messages?: Array<{ role: string; content: string }>;
    disorder_slug?: string;
    locale?: string;
    record?: boolean;
  };

  if (!body.messages?.length || !body.disorder_slug) {
    return NextResponse.json(
      { error: "messages and disorder_slug required" },
      { status: 400 },
    );
  }

  const hcfi = computeHumanConversationFidelityIndex({
    disorder_slug: body.disorder_slug,
    locale: body.locale ?? "en-US",
    messages: body.messages,
    has_speech_profile: true,
    has_alliance_reactivity: true,
    has_cultural_cues: true,
    has_voice_settings: true,
    alliance_band: "moderate",
  });

  if (body.record !== false) {
    recordHcfiHistory({
      overall: hcfi.overall,
      disorder_slug: body.disorder_slug,
      locale: body.locale ?? "en-US",
      computed_at: hcfi.versions.computed_at,
      hcfi,
    });
  }

  return NextResponse.json({ hcfi_version: HCFI_VERSION, hcfi });
}
