import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeSpeechLocale,
  previewSampleText,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import { resolveTtsVoice } from "@/lib/voice/resolve-tts-voice";
import {
  getTtsProvider,
  resolveTtsProviderId,
} from "@/lib/voice/tts/provider";
import { TtsError, type TtsClinicalVoice } from "@/lib/voice/tts/types";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  liveSwitchVoice,
  resolveLiveEmotion,
  toClinicalVoiceProfile,
} from "@/lib/clinical-voice";

type TtsBody = {
  text?: string;
  locale?: string;
  /** Legacy direct provider voice ids (still supported). */
  voiceId?: string;
  voiceIdAr?: string;
  /** Preferred: resolve Avatar → voice_profile → voice_id */
  voiceProfileId?: string;
  avatarId?: string;
  preview?: boolean;
  /** Request streaming synthesis (default true). */
  stream?: boolean;
  /** CB-HCF-007 — optional clinical speech phenotype for prosody. */
  speechPace?: string;
  speechEnergy?: string;
  disorderSlug?: string;
  /** Mission 3 — live emotion switch (depressed|anxious|manic|psychotic|neutral). */
  emotion?: string;
  /** Mission 10 — Humanization Engine prosody overrides. */
  stability?: number;
  style?: number;
};

/**
 * Text-to-speech — provider-neutral.
 *
 * The concrete vendor is chosen in exactly one place
 * (`lib/voice/tts/provider.ts`, via `TTS_PROVIDER`). This handler never names
 * one. Contract preserved: JSON body in, audio/mpeg (or JSON error) out.
 * Clients that cannot stream still receive a complete MPEG response body.
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

  const limited = await rateLimit(`tts:${user.id}`, 60, 60 * 60 * 1000);
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

  const body = (await request.json().catch(() => ({}))) as TtsBody;
  const locale: SessionSpeechLocale = normalizeSpeechLocale(body.locale);
  const text = (body.text?.trim() ||
    (body.preview ? previewSampleText(locale) : "")) as string;

  try {
    const providerId = resolveTtsProviderId();

    // Avatar → voice_profile → voice_id (legacy voiceId* still honored),
    // scoped to the active provider.
    const resolved = await resolveTtsVoice({
      locale,
      voiceProfileId: body.voiceProfileId,
      avatarId: body.avatarId,
      voiceId: body.voiceId,
      voiceIdAr: body.voiceIdAr,
      provider: providerId,
    });

    // Mission 3 — live clinical emotion switching when a registry profile
    // exists. Classification is unchanged; each adapter decides which of these
    // signals its provider can actually honor.
    let clinicalVoice: TtsClinicalVoice | undefined;
    let liveEmotion: string | undefined;
    if (resolved.clinicalProfile) {
      const clinical = toClinicalVoiceProfile(resolved.clinicalProfile);
      const effective = liveSwitchVoice({
        profile: clinical,
        emotion: body.emotion,
        disorderSlug: body.disorderSlug,
      });
      clinicalVoice = {
        speech_rate: effective.speech_rate,
        pitch: effective.pitch,
        pause_scale: effective.pause_scale,
        stability: effective.elevenlabs.stability,
        similarity_boost: effective.elevenlabs.similarity_boost,
        style: effective.elevenlabs.style,
      };
      liveEmotion = effective.emotion;
    } else if (body.emotion || body.disorderSlug) {
      liveEmotion = resolveLiveEmotion({
        emotion: body.emotion,
        disorderSlug: body.disorderSlug,
      });
    }

    // Resolved id already accounts for profile + legacy + env defaults.
    const result = await getTtsProvider().synthesize({
      text,
      locale,
      voiceId: resolved.voiceId,
      voiceIdAr: resolved.voiceId,
      stream: body.stream !== false,
      speechPace: body.speechPace,
      speechEnergy: body.speechEnergy,
      disorderSlug: body.disorderSlug,
      emotion: body.emotion ?? liveEmotion,
      clinicalVoice,
      stability: body.stability,
      style: body.style,
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
        "X-Voice-Provider": result.provider,
        ...requestIdHeaders(requestId),
        ...(body.speechPace
          ? { "X-Voice-Speech-Pace": String(body.speechPace) }
          : {}),
        ...(liveEmotion ? { "X-Voice-Emotion": liveEmotion } : {}),
        ...(resolved.voiceProfileId
          ? { "X-Voice-Profile-Id": resolved.voiceProfileId }
          : {}),
      },
    });
  } catch (error) {
    // Covers every provider: ElevenLabsError extends TtsError.
    if (error instanceof TtsError) {
      console.warn("[tts]", error.code, error.detail ?? error.message);
      return NextResponse.json(
        {
          error: "Text-to-speech failed",
          code: error.code || "TTS_FAILED",
        },
        { status: error.status, headers: requestIdHeaders(requestId) },
      );
    }
    console.warn("[tts]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "TTS failed", code: "TTS_FAILED" },
      { status: 502, headers: requestIdHeaders(requestId) },
    );
  }
}
