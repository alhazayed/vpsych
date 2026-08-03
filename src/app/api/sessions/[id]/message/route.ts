import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageRpcClient } from "@/lib/supabase/admin";
import { generatePatientReplyDetailed } from "@/lib/ai/patient-agent";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  isHceEnabledForSession,
  parseCaseSnapshot,
  runHceTurn,
} from "@/lib/hce";
import { remainingSeconds } from "@/lib/session-timer";
import { expireStaleSession } from "@/lib/session-expiry";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

type ReplyMeta = {
  text: string;
  aiSource: "gpt" | "gateway" | "persona_fallback";
  model?: string;
  errorKind?: string;
  hceEnabled?: boolean;
  reasoningMode?: string;
  alliance?: number;
  trust?: number;
  directorAction?: string;
  disclosureClass?: string;
  patientInterrupt?: boolean;
  voiceHints?: {
    stability: number;
    similarity_boost: number;
    style: number;
    pause_before_ms: number;
    speech_rate?: number;
    stream_chunks?: string[];
  };
};

export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`msg:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    message?: string;
    therapistBargeIn?: boolean;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "message too long (max 4000 characters)" },
      { status: 400 },
    );
  }

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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typed.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }

  const remaining = remainingSeconds(typed.started_at, typed.max_duration_sec);
  if (remaining <= 0) {
    await expireStaleSession(supabase, typed);
    return NextResponse.json(
      { error: "Session time expired", expired: true },
      { status: 409 },
    );
  }

  const caseSnapshot = parseCaseSnapshot(typed.clinical_snapshot);
  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: caseSnapshot ?? typed.clinical_snapshot,
  });

  const { data: userMsg, error: userMsgError } = await supabase
    .from("session_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: message,
    })
    .select("*")
    .single();

  if (userMsgError || !userMsg) {
    console.error("[sessions/message] user message save failed", {
      sessionId,
      error: userMsgError?.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to save message", userMsgError) },
      { status: 500 },
    );
  }

  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const historyRows = (history ?? []) as Pick<SessionMessage, "role" | "content">[];
  const writer = messageRpcClient(supabase);

  let replyMeta: ReplyMeta;
  const useHce =
    isHceEnabledForSession(Boolean(caseSnapshot)) &&
    caseSnapshot &&
    typed.case_instance_id;

  try {
    if (useHce) {
      let memoryRow: {
        case_instance_id: string;
        memory: Record<string, unknown>;
        longitudinal_group_id?: string | null;
      } | null = null;

      const { data: mem } = await writer
        .from("case_memory")
        .select("case_instance_id, memory, longitudinal_group_id")
        .eq("case_instance_id", typed.case_instance_id!)
        .maybeSingle();

      if (mem) {
        memoryRow = mem as {
          case_instance_id: string;
          memory: Record<string, unknown>;
          longitudinal_group_id?: string | null;
        };
      }

      const elapsedSeconds = typed.max_duration_sec - remaining;

      const hceResult = await runHceTurn({
        sessionId,
        avatar: resolved,
        caseSnapshot,
        caseInstanceId: typed.case_instance_id!,
        history: historyRows,
        userMessage: message,
        sessionLanguage: typed.language ?? resolved.language,
        elapsedSeconds,
        maxDurationSec: typed.max_duration_sec,
        memoryRow,
        writer,
        therapistBargeIn: body.therapistBargeIn ?? false,
      });

      replyMeta = {
        text: hceResult.text,
        aiSource: hceResult.aiSource,
        model: hceResult.model,
        errorKind: hceResult.errorKind,
        hceEnabled: true,
        reasoningMode: hceResult.reasoningMode,
        alliance: hceResult.alliance,
        trust: hceResult.trust,
        directorAction: hceResult.directorAction,
        disclosureClass: hceResult.disclosureClass,
        patientInterrupt: hceResult.patientInterrupt,
        voiceHints: {
          stability: hceResult.voiceHints.stability,
          similarity_boost: hceResult.voiceHints.similarity_boost,
          style: hceResult.voiceHints.style,
          pause_before_ms: hceResult.voiceHints.pause_before_ms,
          speech_rate: hceResult.voiceHints.speech_rate,
          stream_chunks: hceResult.voiceHints.stream_chunks,
        },
      };
    } else {
      const legacy = await generatePatientReplyDetailed({
        avatar: resolved,
        history: historyRows,
        userMessage: message,
      });
      replyMeta = {
        text: legacy.text,
        aiSource: legacy.aiSource,
        model: legacy.model,
        errorKind: legacy.errorKind,
        hceEnabled: false,
      };
    }
  } catch (err) {
    console.error("[sessions/message] patient reply generation failed", {
      sessionId,
      language: typed.language,
      hce: useHce,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to generate patient reply" },
      { status: 502 },
    );
  }

  console.info("[sessions/message] assistant reply", {
    sessionId,
    language: typed.language,
    aiSource: replyMeta.aiSource,
    aiModel: replyMeta.model ?? null,
    errorKind: replyMeta.errorKind ?? null,
    hce: replyMeta.hceEnabled ?? false,
    reasoningMode: replyMeta.reasoningMode ?? null,
  });

  const { data: assistantMsg, error: assistantError } = await writer.rpc(
    "insert_assistant_message",
    {
      p_session_id: sessionId,
      p_content: replyMeta.text,
    },
  );

  if (assistantError || !assistantMsg) {
    console.error("[sessions/message] assistant message save failed", {
      sessionId,
      error: assistantError?.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to save reply", assistantError) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      remainingSeconds: remainingSeconds(
        typed.started_at,
        typed.max_duration_sec,
      ),
      locale: typed.language ?? resolved.language,
      aiSource: replyMeta.aiSource,
      aiModel: replyMeta.model ?? null,
      aiErrorKind: replyMeta.errorKind ?? null,
      hceEnabled: replyMeta.hceEnabled ?? false,
      reasoningMode: replyMeta.reasoningMode ?? null,
      alliance: replyMeta.alliance ?? null,
      trust: replyMeta.trust ?? null,
      directorAction: replyMeta.directorAction ?? null,
      disclosureClass: replyMeta.disclosureClass ?? null,
      patientInterrupt: replyMeta.patientInterrupt ?? false,
      voiceHints: replyMeta.voiceHints ?? null,
    },
    {
      headers: {
        "X-AI-Source": replyMeta.aiSource,
        ...(replyMeta.model ? { "X-AI-Model": replyMeta.model } : {}),
        ...(replyMeta.errorKind
          ? { "X-AI-Error-Kind": replyMeta.errorKind }
          : {}),
        ...(replyMeta.hceEnabled ? { "X-HCE-Enabled": "1" } : {}),
        ...(replyMeta.reasoningMode
          ? { "X-HCE-Reasoning-Mode": replyMeta.reasoningMode }
          : {}),
      },
    },
  );
}
