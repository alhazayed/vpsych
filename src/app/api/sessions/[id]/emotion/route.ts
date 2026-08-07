import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageRpcClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  EMOTION_ENGINE_VERSION,
  classifyTherapistIntervention,
  ensureEmotionState,
  emotionSnapshot,
  initEmotionState,
  loadEmotionState,
  processEmotionTurn,
  tickEmotion,
  type TherapistIntervention,
} from "@/lib/emotion";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const INTERVENTIONS: TherapistIntervention[] = [
  "validation",
  "empathy",
  "reflection",
  "open_question",
  "closed_question",
  "support",
  "psychoeducation",
  "confrontation",
  "advice",
  "hostility",
  "invalidation",
  "rupture_repair",
  "safety_check",
  "silence",
  "other",
];

function isIntervention(v: unknown): v is TherapistIntervention {
  return typeof v === "string" && (INTERVENTIONS as string[]).includes(v);
}

function disorderFromSession(
  session: TherapySession,
): string | null {
  const snap = session.clinical_snapshot as CaseInstanceSnapshot | null | undefined;
  if (snap?.primary_diagnosis?.slug) return snap.primary_diagnosis.slug;
  return null;
}

/**
 * GET — current Emotion Engine state + expression for a session.
 * Initializes from disorder baseline when case_memory has no emotion yet.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`emotion:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      "id, therapist_id, status, case_instance_id, clinical_snapshot, started_at, max_duration_sec",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession;
  if (typed.therapist_id !== user.id) {
    // Admins may inspect via requireApiAdmin paths later; therapists only own.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const disorderSlug = disorderFromSession(typed);
  const writer = messageRpcClient(supabase);

  let state;
  if (typed.case_instance_id) {
    state = await ensureEmotionState(writer, {
      caseInstanceId: typed.case_instance_id,
      sessionId,
      disorderSlug,
    });
  } else {
    state = initEmotionState({
      sessionId,
      disorderSlug,
    });
  }

  if (!state) {
    return NextResponse.json(
      { error: clientSafeError("Emotion state unavailable") },
      { status: 500 },
    );
  }

  const snap = emotionSnapshot(state);
  return NextResponse.json({
    emotionEngineVersion: EMOTION_ENGINE_VERSION,
    ...snap,
  });
}

/**
 * POST — advance emotion state for a therapist turn, or dry-run simulate.
 *
 * Body:
 *   message?: string
 *   intervention?: TherapistIntervention
 *   secondary?: TherapistIntervention[]
 *   simulate?: boolean  — if true, do not persist
 *   reset?: boolean     — re-init from disorder baseline
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

  const limited = await rateLimit(`emotion:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    intervention?: string;
    secondary?: string[];
    simulate?: boolean;
    reset?: boolean;
  };

  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      "id, therapist_id, status, case_instance_id, clinical_snapshot, started_at, max_duration_sec",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession;
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const disorderSlug = disorderFromSession(typed);
  const writer = messageRpcClient(supabase);
  const intervention = isIntervention(body.intervention)
    ? body.intervention
    : undefined;
  const secondary = Array.isArray(body.secondary)
    ? body.secondary.filter(isIntervention)
    : undefined;

  if (body.reset) {
    const fresh = initEmotionState({
      caseInstanceId: typed.case_instance_id,
      sessionId,
      disorderSlug,
    });
    if (!body.simulate && typed.case_instance_id) {
      const { saveEmotionState } = await import("@/lib/emotion/store");
      await saveEmotionState(writer, typed.case_instance_id, fresh);
    }
    const snap = emotionSnapshot(fresh);
    return NextResponse.json({
      emotionEngineVersion: EMOTION_ENGINE_VERSION,
      reset: true,
      persisted: !body.simulate && Boolean(typed.case_instance_id),
      ...snap,
    });
  }

  if (body.simulate) {
    let state =
      typed.case_instance_id
        ? await loadEmotionState(writer, typed.case_instance_id)
        : null;
    state ??= initEmotionState({
      caseInstanceId: typed.case_instance_id,
      sessionId,
      disorderSlug,
    });

    const classified =
      !intervention && body.message
        ? classifyTherapistIntervention(body.message)
        : null;

    const tick = tickEmotion({
      state,
      therapistMessage: body.message,
      intervention: intervention ?? classified?.primary,
      secondary: secondary ?? classified?.secondary,
      disorderSlug,
    });

    return NextResponse.json({
      emotionEngineVersion: EMOTION_ENGINE_VERSION,
      simulate: true,
      persisted: false,
      applied: tick.applied,
      state: tick.state,
      expression: tick.expression,
    });
  }

  if (!body.message && !intervention) {
    return NextResponse.json(
      { error: "message or intervention required" },
      { status: 400 },
    );
  }

  const result = await processEmotionTurn({
    supabase: writer,
    caseInstanceId: typed.case_instance_id,
    sessionId,
    disorderSlug,
    therapistMessage: body.message ?? "",
    intervention,
    elapsedSeconds: undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError(result.reason) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    emotionEngineVersion: EMOTION_ENGINE_VERSION,
    persisted: result.persisted,
    applied: result.applied,
    state: result.state,
    expression: result.expression,
  });
}
