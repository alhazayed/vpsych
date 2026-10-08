import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  openAIService,
  hasOpenAIApiKey,
  OpenAIServiceError,
} from "@/lib/ai/openai";
import { openAISpeechLanguage, sttProviderFailure } from "@/lib/voice/stt";
import {
  isLiveTranscriptEnabled,
  LIVE_TRANSCRIPT_WS_URL,
} from "@/lib/voice/live-transcript-protocol";

/**
 * Live transcript credential (Therapy Room).
 *
 * POST { locale } → { clientSecret, expiresAt, model, url }
 *
 * Mints a short-lived OpenAI Realtime client secret for a transcription-only
 * session (same STT model as /api/voice/transcribe). The browser streams the
 * therapist's microphone audio to OpenAI while they speak, so the transcript
 * is ready moments after they pause. /api/voice/transcribe stays the fallback.
 *
 * The secret only opens a session for ~60 s, but OpenAI lets the client
 * override session settings, so it is not a hard transcription-only scope:
 * approved accounts only, and minting is rate-limited (one per room
 * connection; reconnects are rare).
 *
 * `VOICE_LIVE_TRANSCRIPT=false` turns it off (404 → the client uses the
 * classic STT path).
 */
const LIVE_TRANSCRIPT_MINTS_PER_HOUR = 30;

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const headers = requestIdHeaders(requestId);

  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `stt-live:${auth.user.id}`,
    LIVE_TRANSCRIPT_MINTS_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec), ...headers },
      },
    );
  }

  if (!isLiveTranscriptEnabled()) {
    return NextResponse.json(
      { error: "Not found", code: "LIVE_TRANSCRIPT_OFF" },
      { status: 404, headers },
    );
  }
  if (!hasOpenAIApiKey()) {
    return NextResponse.json(
      { error: "Live transcript is not configured.", code: "STT_UNAVAILABLE" },
      { status: 501, headers },
    );
  }

  let locale = "en";
  try {
    const body = (await request.json()) as { locale?: unknown };
    if (typeof body.locale === "string") locale = body.locale.slice(0, 16);
  } catch {
    /* empty body → English */
  }

  try {
    const secret = await openAIService.createLiveTranscriptionSecret({
      language: openAISpeechLanguage(locale),
    });
    return NextResponse.json(
      {
        clientSecret: secret.value,
        expiresAt: secret.expiresAt,
        model: secret.model,
        url: LIVE_TRANSCRIPT_WS_URL,
      },
      { headers },
    );
  } catch (error) {
    console.warn(
      "[stt-live]",
      error instanceof OpenAIServiceError
        ? { kind: error.kind, providerCode: error.providerCode ?? null }
        : "unexpected",
    );
    const mapped =
      error instanceof OpenAIServiceError
        ? sttProviderFailure(error)
        : { error: "Live transcript is unavailable.", code: "STT_LIVE_FAILED", status: 502 };
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status, headers },
    );
  }
}
