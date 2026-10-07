import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  openAIService,
  hasOpenAIApiKey,
  OpenAIServiceError,
} from "@/lib/ai/openai";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  audioTooLargeError,
  audioTypeNotAllowedError,
  emptyAudioError,
  guessAudioExtension,
  isAllowedSttMime,
  MAX_STT_AUDIO_BYTES,
  notConfiguredError,
  openAISpeechLanguage,
  speechLocaleTag,
  sttProviderFailure,
  type TranscribeSuccess,
} from "@/lib/voice/stt";
import { sanitizeProviderError } from "@/lib/safe-client-error";

/**
 * Speculative transcripts (`?speculative=1`): the Therapy Room transcribes the
 * audio so far at each pause, before it knows whether the therapist is done,
 * so one turn can take several calls. Their own bucket keeps that from
 * exhausting the per-turn `stt` budget mid-session.
 */
const SPECULATIVE_STT_PER_HOUR = 240;

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
  const requestId = resolveRequestId(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: requestIdHeaders(requestId) },
    );
  }

  const speculative =
    new URL(request.url).searchParams.get("speculative") === "1";
  const limited = speculative
    ? await rateLimit(
        `stt-spec:${user.id}`,
        SPECULATIVE_STT_PER_HOUR,
        60 * 60 * 1000,
      )
    : await rateLimit(`stt:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          ...requestIdHeaders(requestId),
        },
      },
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

  if (audio.size > MAX_STT_AUDIO_BYTES) {
    const err = audioTooLargeError();
    return NextResponse.json(
      { error: err.error, code: err.code },
      { status: err.status },
    );
  }

  if (!isAllowedSttMime(audio.type || "")) {
    const err = audioTypeNotAllowedError();
    return NextResponse.json(
      { error: err.error, code: err.code },
      { status: err.status },
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

    return NextResponse.json(body, { headers: requestIdHeaders(requestId) });
  } catch (error) {
    console.warn(
      "[stt]",
      error instanceof Error ? error.message : String(error),
      error instanceof OpenAIServiceError
        ? { kind: error.kind, providerCode: error.providerCode ?? null }
        : "",
    );
    const mapped =
      error instanceof OpenAIServiceError
        ? sttProviderFailure(error)
        : {
            ...sanitizeProviderError(error, {
              code: "OPENAI_STT_FAILED",
              fallback: "Speech transcription failed",
            }),
            status: 502,
          };

    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status, headers: requestIdHeaders(requestId) },
    );
  }
}
