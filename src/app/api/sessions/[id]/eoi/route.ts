import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { buildServerCaptureContext } from "@/lib/cqi";
import {
  buildEoiRpcPayload,
  eoiMemoryEnabled,
  eoiMemoryInsert,
  eoiMemoryList,
  recordEoiLedgerSignal,
  validateEoiSubmission,
} from "@/lib/eoi";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET — list caller's EOI opportunities for session */
export async function GET(_request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`eoi-get:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await supabase
    .from("eoi_opportunities")
    .select(
      "id, created_at, opportunity_type, educational_impact, status, fingerprint, disorder_slug",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    if (eoiMemoryEnabled()) {
      return NextResponse.json({
        opportunities: eoiMemoryList().filter(
          (r) => r.session_id === sessionId && r.reviewer_id === user.id,
        ),
        source: "memory",
        is_defect: false,
      });
    }
    return NextResponse.json(
      { error: clientSafeError("Failed to load opportunities", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    opportunities: data ?? [],
    source: "database",
    is_defect: false,
  });
}

/** POST — capture educational opportunity (never a defect) */
export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`eoi-post:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const raw = await request.json().catch(() => null);
  const validated = validateEoiSubmission({
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

  const browser =
    (submission.context.browser as
      | { user_agent?: string }
      | undefined) ?? {};

  const enrichedCtx = buildServerCaptureContext({
    session: typed,
    avatar: resolved,
    messages: (messages ?? []) as SessionMessage[],
    browser: {
      user_agent:
        browser.user_agent || request.headers.get("user-agent") || "unknown",
    },
  });

  const rpcPayload = buildEoiRpcPayload(submission, {
    case_instance_id: enrichedCtx.case_instance_id,
    avatar_id: enrichedCtx.avatar_id,
    transcript_window: enrichedCtx.transcript_window,
    platform_version: enrichedCtx.platform_version,
    release_version: enrichedCtx.release_version,
    prompt_version: enrichedCtx.prompt_version,
    language: enrichedCtx.language,
    disorder_slug: enrichedCtx.disorder_slug,
    difficulty: enrichedCtx.difficulty,
    context: enrichedCtx as unknown as Record<string, unknown>,
  });

  const { data: oppId, error: rpcError } = await supabase.rpc(
    "eoi_submit_opportunity",
    { p_payload: rpcPayload },
  );

  if (rpcError || !oppId) {
    if (!eoiMemoryEnabled()) {
      return NextResponse.json(
        { error: clientSafeError("Failed to store opportunity", rpcError) },
        { status: 500 },
      );
    }
    const mem = eoiMemoryInsert({
      reviewer_id: submission.anonymous ? null : user.id,
      anonymous: Boolean(submission.anonymous),
      session_id: sessionId,
      opportunity_type: submission.opportunity_type,
      educational_impact: submission.educational_impact,
      target_learners: submission.target_learners,
      competencies: submission.competencies,
      idea_text: submission.idea_text,
      design_sketch: submission.design_sketch ?? null,
      expected_learning_experience:
        submission.expected_learning_experience ?? null,
      annotations: submission.annotations ?? [],
      transcript_window: enrichedCtx.transcript_window,
      fingerprint: String(rpcPayload.fingerprint ?? ""),
      platform_version: enrichedCtx.platform_version,
      release_version: enrichedCtx.release_version,
      prompt_version: enrichedCtx.prompt_version,
      language: enrichedCtx.language,
      disorder_slug: enrichedCtx.disorder_slug,
      difficulty: enrichedCtx.difficulty,
      context: { ...(rpcPayload.context as object), is_defect: false },
      evidence: { is_defect: false },
    });
    recordEoiLedgerSignal({
      opportunity_id: mem.id,
      opportunity_type: mem.opportunity_type,
      educational_impact: mem.educational_impact,
      disorder_slug: mem.disorder_slug,
      competencies: mem.competencies,
      release_version: mem.release_version,
      is_defect: false,
    });
    return NextResponse.json({
      ok: true,
      opportunity_id: mem.id,
      source: "memory",
      is_defect: false,
      kind: "educational_opportunity",
    });
  }

  recordEoiLedgerSignal({
    opportunity_id: String(oppId),
    opportunity_type: submission.opportunity_type,
    educational_impact: submission.educational_impact,
    disorder_slug: enrichedCtx.disorder_slug,
    competencies: submission.competencies,
    release_version: enrichedCtx.release_version,
    is_defect: false,
  });

  return NextResponse.json({
    ok: true,
    opportunity_id: oppId,
    source: "database",
    is_defect: false,
    kind: "educational_opportunity",
  });
}
