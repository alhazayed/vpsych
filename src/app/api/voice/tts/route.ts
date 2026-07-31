import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hasElevenLabs,
  normalizeSpeechLocale,
  previewSampleText,
  resolveElevenLabsVoiceId,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import { rateLimit } from "@/lib/rate-limit";

type TtsBody = {
  text?: string;
  locale?: string;
  voiceId?: string;
  voiceIdAr?: string;
  preview?: boolean;
};

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

  if (!hasElevenLabs()) {
    return NextResponse.json(
      {
        error: "ElevenLabs not configured. Set ELEVENLABS_API_KEY.",
        code: "TTS_UNAVAILABLE",
      },
      { status: 501 },
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

  const voiceId = resolveElevenLabsVoiceId({
    locale,
    voiceId: body.voiceId,
    voiceIdAr: body.voiceIdAr,
  });

  const modelId =
    process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      {
        error: "ElevenLabs TTS failed",
        detail: detail.slice(0, 500),
        voiceId,
      },
      { status: 502 },
    );
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Voice-Id": voiceId,
      "X-Voice-Locale": locale,
    },
  });
}
