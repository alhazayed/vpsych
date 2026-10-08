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
  publicEmotionState,
  tickEmotion,
  type TherapistIntervention,
} from "@/lib/emotion";
import { MAX_TURN_MESSAGE_CHARS } from "@/lib/sessions/clinical-turn";
import { withSkillTestCase } from "@/lib/skill-tests";
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
  // A skill test session keeps its case sealed; open it on the server only.
  const opened = withSkillTestCase(session);
  const snap = (opened.ok ? opened.session.clinical_snapshot : null) as
    | CaseInstanceSnapshot
    | null
    | undefined;
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
      "id, therapist_id, status, case_instance_id, clinical_snapshot, skill_test_assignment_id, sealed_case, started_at, max_duration_sec",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession;
  let adminView = false;
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
    adminView = true;
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

  // The owner never sees the diagnosis: a skill test keeps it sealed.
  const snap = emotionSnapshot(state);
  return NextResponse.json({
    emotionEngineVersion: EMOTION_ENGINE_VERSION,
    state: adminView ? snap.state : publicEmotionState(snap.state),
    expression: snap.expression,
  });
}

/**
 * POST — dry-run simulate only (`simulate: true`); nothing is persisted.
 * Live emotion changes happen only in the session message routes.
 *
 * Body:
 *   message?: string
 *   intervention?: TherapistIntervention
 *   secondary?: TherapistIntervention[]
 *   simulate: true      — required; anything else is 403 EMOTION_READ_ONLY
 *   reset?: boolean     — preview the baseline state (not persisted)
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
      "id, therapist_id, status, case_instance_id, clinical_snapshot, skill_test_assignment_id, sealed_case, started_at, max_duration_sec",
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

  // Emotion state advances only through real session turns (the message
  // routes). A persisting reset or tick from here would let the trainee
  // steer the patient, including in a skill test.
  if (!body.simulate) {
    return NextResponse.json(
      {
        error: "Patient emotion changes only through session turns",
        code: "EMOTION_READ_ONLY",
      },
      { status: 403 },
    );
  }

  if (
    body.message !== undefined &&
    (typeof body.message !== "string" ||
      body.message.length > MAX_TURN_MESSAGE_CHARS)
  ) {
    return NextResponse.json(
      { error: `message too long (max ${MAX_TURN_MESSAGE_CHARS} characters)` },
      { status: 400 },
    );
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
    const snap = emotionSnapshot(fresh);
    return NextResponse.json({
      emotionEngineVersion: EMOTION_ENGINE_VERSION,
      simulate: true,
      reset: true,
      persisted: false,
      state: publicEmotionState(snap.state),
      expression: snap.expression,
    });
  }

  let state = typed.case_instance_id
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
    state: publicEmotionState(tick.state),
    expression: tick.expression,
  });
}
