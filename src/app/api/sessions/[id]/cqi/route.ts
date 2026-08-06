import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  buildServerCaptureContext,
  buildVaultRpcPayload,
  memoryInsertFlag,
  memoryListFlags,
  memoryVaultEnabled,
  recordCqiLedgerSignal,
  validateFlagSubmission,
} from "@/lib/cqi";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET — list caller's flags for this session. */
export async function GET(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`cqi-get:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await supabase
    .from("cqi_flags")
    .select(
      "id, created_at, category, severity, confidence, status, fingerprint, disorder_slug, language",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    if (memoryVaultEnabled()) {
      const mem = memoryListFlags().filter(
        (f) => f.session_id === sessionId && f.reviewer_id === user.id,
      );
      return NextResponse.json({ flags: mem, source: "memory" });
    }
    return NextResponse.json(
      { error: clientSafeError("Failed to load flags", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ flags: data ?? [], source: "database" });
}

/**
 * POST — Flag this moment.
 * Captures full context server-side; client supplies structured review + browser hints.
 */
export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`cqi-flag:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const raw = await request.json().catch(() => null);
  const validated = validateFlagSubmission({
    ...(raw && typeof raw === "object" ? raw : {}),
    session_id: sessionId,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const submission = validated.submission;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    // Admins may flag during observation if they own or are admin — keep simple: owner only
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });

  const browser = submission.context.browser ?? {
    user_agent: request.headers.get("user-agent") ?? "unknown",
  };

  const enriched = buildServerCaptureContext({
    session: typed,
    avatar: resolved,
    messages: (messages ?? []) as SessionMessage[],
    browser: {
      ...browser,
      user_agent:
        browser.user_agent || request.headers.get("user-agent") || "unknown",
    },
    patient_mind_state: submission.context.patient_mind_state ?? null,
    assessment_state: submission.context.assessment_state ?? null,
    llm_model: submission.context.llm_model,
  });

  // Prefer client annotations / optional mind snapshot overlays
  if (submission.annotations?.length) {
    enriched.transcript_window = enriched.transcript_window;
  }

  const rpcPayload = buildVaultRpcPayload(submission, enriched);

  const { data: flagId, error: rpcError } = await supabase.rpc(
    "cqi_submit_flag",
    { p_payload: rpcPayload },
  );

  if (rpcError || !flagId) {
    if (!memoryVaultEnabled()) {
      return NextResponse.json(
        { error: clientSafeError("Failed to store flag", rpcError) },
        { status: 500 },
      );
    }
    const mem = memoryInsertFlag({
      reviewer_id: submission.anonymous ? null : user.id,
      anonymous: Boolean(submission.anonymous),
      session_id: sessionId,
      category: submission.category,
      severity: submission.severity,
      confidence: submission.confidence,
      free_text: submission.free_text,
      suggested_improvement: submission.suggested_improvement ?? null,
      expected_behaviour: submission.expected_behaviour ?? null,
      reduces_educational_quality:
        submission.reduces_educational_quality ?? null,
      usable_in_residency: submission.usable_in_residency ?? null,
      scores: submission.scores ?? {},
      would_recommend: submission.would_recommend ?? null,
      annotations: submission.annotations ?? [],
      transcript_window: enriched.transcript_window,
      fingerprint: String(rpcPayload.fingerprint ?? ""),
      platform_version: enriched.platform_version,
      release_version: enriched.release_version,
      prompt_version: enriched.prompt_version,
      pme_version: enriched.pme_version,
      disorder_slug: enriched.disorder_slug,
      language: enriched.language,
      context: enriched,
      evidence: (rpcPayload.evidence as Record<string, unknown>) ?? {},
    });
    recordCqiLedgerSignal({
      flag_id: mem.id,
      category: mem.category,
      severity: mem.severity,
      disorder_slug: mem.disorder_slug,
      language: mem.language,
      release_version: mem.release_version,
      prompt_version: mem.prompt_version,
      scores: mem.scores,
    });
    return NextResponse.json({
      ok: true,
      flag_id: mem.id,
      source: "memory",
      context_captured: true,
    });
  }

  recordCqiLedgerSignal({
    flag_id: String(flagId),
    category: submission.category,
    severity: submission.severity,
    disorder_slug: enriched.disorder_slug,
    language: enriched.language,
    release_version: enriched.release_version,
    prompt_version: enriched.prompt_version,
    scores: submission.scores,
  });

  return NextResponse.json({
    ok: true,
    flag_id: flagId,
    source: "database",
    context_captured: true,
  });
}
