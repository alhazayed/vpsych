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
import { rateLimit } from "@/lib/rate-limit";

type TtsBody = {
  text?: string;
  locale?: string;
  voiceId?: string;
  voiceIdAr?: string;
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

  const limited = rateLimit(`tts:${user.id}`, 60, 60 * 60 * 1000);
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

  try {
    const result = await elevenLabsService.synthesize({
      text,
      locale,
      voiceId: body.voiceId,
      voiceIdAr: body.voiceIdAr,
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
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          detail: error.detail,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "TTS failed", code: "TTS_FAILED" },
      { status: 502 },
    );
  }
}
