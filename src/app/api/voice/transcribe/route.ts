import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  openAIService,
  hasOpenAIApiKey,
  OpenAIServiceError,
} from "@/lib/ai/openai";
import { rateLimit } from "@/lib/rate-limit";
import {
  emptyAudioError,
  guessAudioExtension,
  notConfiguredError,
  openAISpeechLanguage,
  speechLocaleTag,
  type TranscribeSuccess,
} from "@/lib/voice/stt";

/**
 * OpenAI Speech-to-Text — primary (and only server) STT pipeline.
 *
 * Voice Session contract (unchanged):
 *   POST multipart/form-data
 *     - audio: Blob
 *     - locale: session.language (en | ar | en-US | ar-JO | …)
 *   Response JSON
 *     - { transcript, provider: "openai", model, locale, language }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`stt:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!hasOpenAIApiKey()) {
    const err = notConfiguredError();
    return NextResponse.json(
      { error: err.error, code: err.code },
      { status: err.status },
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  // Automatically follow session.language via the client-supplied locale field.
  const localeRaw = String(form.get("locale") ?? "en");
  const language = openAISpeechLanguage(localeRaw);
  const localeTag = speechLocaleTag(language);

  if (!(audio instanceof Blob) || audio.size === 0) {
    const err = emptyAudioError();
    return NextResponse.json(
      { error: err.error, code: err.code },
      { status: err.status },
    );
  }

  // Cap upload size to limit STT cost / DoS (10 MiB).
  const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: "Audio too large (max 10MB)",
        code: "AUDIO_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  const mime = (audio.type || "audio/wav").toLowerCase();
  const allowedMime =
    mime.startsWith("audio/") ||
    mime === "application/octet-stream" ||
    mime === "video/webm";
  if (!allowedMime) {
    return NextResponse.json(
      { error: "Unsupported audio type", code: "AUDIO_TYPE_UNSUPPORTED" },
      { status: 415 },
    );
  }

  try {
    const ext = guessAudioExtension(audio.type || "audio/wav");
    const result = await openAIService.speechToText({
      audio,
      filename: `speech.${ext}`,
      language,
    });

    const body: TranscribeSuccess = {
      transcript: result.transcript,
      provider: "openai",
      model: result.model,
      locale: localeTag,
      language,
    };

    return NextResponse.json(body);
  } catch (error) {
    const mapped =
      error instanceof OpenAIServiceError
        ? error
        : new OpenAIServiceError("OpenAI STT failed", {
            code: "OPENAI_UNKNOWN",
            kind: "unknown",
            status: 502,
            retryable: false,
          });

    console.error("[voice/transcribe] STT failed", {
      code: mapped.code,
      status: mapped.status,
      message: mapped.message,
    });

    return NextResponse.json(
      {
        error: "Transcription failed",
        code: mapped.code || "OPENAI_STT_FAILED",
      },
      {
        status:
          mapped.status && mapped.status >= 400 && mapped.status < 600
            ? mapped.status
            : 502,
      },
    );
  }
}
