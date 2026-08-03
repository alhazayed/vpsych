import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeSpeechLocale,
  previewSampleText,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import {
  elevenLabsService,
  ElevenLabsError,
} from "@/lib/voice/elevenlabs";
import { resolveTtsVoice } from "@/lib/voice/resolve-tts-voice";
import { rateLimit } from "@/lib/rate-limit";

type TtsBody = {
  text?: string;
  locale?: string;
  /** Legacy direct ElevenLabs ids (still supported). */
  voiceId?: string;
  voiceIdAr?: string;
  /** Preferred: resolve Avatar → voice_profile → voice_id */
  voiceProfileId?: string;
  avatarId?: string;
  preview?: boolean;
  /** Request streaming synthesis (default true). */
  stream?: boolean;
};

/**
 * ElevenLabs TTS — streams audio/mpeg when available.
 * Contract preserved: JSON body in, audio/mpeg (or JSON error) out.
 * Clients that cannot stream still receive a complete MPEG response body.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`tts:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as TtsBody;
  const locale: SessionSpeechLocale = normalizeSpeechLocale(body.locale);
  const text = (body.text?.trim() ||
    (body.preview ? previewSampleText(locale) : "")) as string;

  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (text.length > 2500) {
    return NextResponse.json(
      { error: "text too long (max 2500 characters)" },
      { status: 400 },
    );
  }
  if (!body.avatarId && !body.voiceProfileId) {
    return NextResponse.json(
      { error: "avatarId or voiceProfileId required" },
      { status: 400 },
    );
  }

  try {
    // Resolve only from avatar / voice_profile registry — never honor
    // client-supplied ElevenLabs voice ids (cost / abuse surface).
    const resolved = await resolveTtsVoice({
      locale,
      voiceProfileId: body.voiceProfileId,
      avatarId: body.avatarId,
      voiceId: null,
      voiceIdAr: null,
    });

    if (!resolved.voiceId) {
      return NextResponse.json(
        { error: "No voice configured for avatar" },
        { status: 422 },
      );
    }

    // Resolved id already accounts for profile + legacy + env defaults.
    const result = await elevenLabsService.synthesize({
      text,
      locale,
      voiceId: resolved.voiceId,
      voiceIdAr: resolved.voiceId,
      stream: body.stream !== false,
    });

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": result.cached
          ? "private, max-age=60"
          : "no-store",
        "X-Voice-Id": result.voiceId,
        "X-Voice-Locale": result.locale,
        "X-Voice-Model": result.modelId,
        "X-Voice-Cached": result.cached ? "1" : "0",
        "X-Voice-Streamed": result.streamed ? "1" : "0",
        "X-Voice-Source": resolved.source,
        ...(resolved.voiceProfileId
          ? { "X-Voice-Profile-Id": resolved.voiceProfileId }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      console.warn("[tts]", error.code, error.detail ?? error.message);
      return NextResponse.json(
        {
          error: "Text-to-speech failed",
          code: error.code || "TTS_FAILED",
        },
        { status: error.status },
      );
    }
    console.warn("[tts]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "TTS failed", code: "TTS_FAILED" },
      { status: 502 },
    );
  }
}
