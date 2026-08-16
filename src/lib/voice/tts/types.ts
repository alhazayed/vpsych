/**
 * Provider-neutral TTS contract.
 *
 * Every TTS provider (ElevenLabs, Google Cloud) implements `TtsProvider`.
 * The route (`/api/voice/tts`) depends on this module only — never on a
 * concrete provider. The result shape is deliberately identical to what the
 * route already returned so the downstream contract is unchanged:
 *
 *   Response.body → Blob → object URL → HTMLAudioElement
 *
 * Nothing here knows about VAD, endpointing, barge-in, or the conversation
 * FSM; those are upstream of this layer and untouched by provider selection.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

export type TtsProviderId = "google" | "elevenlabs";

export const TTS_PROVIDER_IDS: readonly TtsProviderId[] = [
  "google",
  "elevenlabs",
] as const;

export function isTtsProviderId(value: unknown): value is TtsProviderId {
  return (
    typeof value === "string" &&
    (TTS_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/**
 * Client-visible failure codes. Kept provider-neutral so the browser never
 * learns which vendor synthesized (or failed to synthesize) the turn.
 */
export type TtsErrorCode =
  | "BAD_REQUEST"
  | "TTS_UNAVAILABLE"
  | "TTS_CONFIG"
  | "TTS_VOICE_INVALID"
  | "TTS_QUOTA"
  | "TTS_PLAN_REQUIRED"
  | "TTS_TIMEOUT"
  | "TTS_FAILED";

export class TtsError extends Error {
  readonly code: TtsErrorCode | string;
  readonly status: number;
  /** Server-side diagnostic only. Never returned to a client. */
  readonly detail?: string;

  constructor(
    message: string,
    options: { code: TtsErrorCode | string; status: number; detail?: string },
  ) {
    super(message);
    this.name = "TtsError";
    this.code = options.code;
    this.status = options.status;
    this.detail = options.detail;
  }
}

/**
 * Clinical delivery signals produced by the clinical layers
 * (`lib/clinical-voice`, `lib/humanization`, `lib/emotion`, `lib/voice/prosody`).
 *
 * This is a transport carrier, not a provider format. Each adapter consumes
 * only the fields its provider can actually honor, and reports the rest as
 * unsupported rather than inventing an equivalent. See
 * `lib/voice/google/prosody.ts` for the Google mapping and its documented gaps.
 */
export type TtsClinicalVoice = {
  /** Relative rate, 1.0 = clinical baseline (CVP range 0.5–1.8). */
  speech_rate?: number | null;
  /** Relative pitch, 1.0 = clinical baseline (CVP range 0.5–1.8). */
  pitch?: number | null;
  /** Relative pause length, 1.0 = baseline. */
  pause_scale?: number | null;
  /** ElevenLabs expressiveness controls — no Google equivalent. */
  stability?: number | null;
  similarity_boost?: number | null;
  style?: number | null;
};

export type TtsSynthesizeParams = {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  /** Prefer a streaming transport when the provider offers one (default true). */
  stream?: boolean;
  /** CB-HCF-007 — clinical speech phenotype hints. */
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  /**
   * Clinical emotion band (depressed | anxious | manic | psychotic | neutral).
   * Classification happens upstream and is unchanged by provider selection;
   * adapters may only influence delivery where the provider supports it.
   */
  emotion?: string | null;
  /** Resolved clinical delivery signals (from CVP live-switch). */
  clinicalVoice?: TtsClinicalVoice | null;
  /** Humanization Engine prosody overrides. */
  stability?: number | null;
  style?: number | null;
};

export type TtsSynthesizeResult = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  voiceId: string;
  locale: SessionSpeechLocale;
  modelId: string;
  cached: boolean;
  streamed: boolean;
  provider: TtsProviderId;
};

export interface TtsProvider {
  readonly id: TtsProviderId;
  /** True when the provider has enough configuration to attempt synthesis. */
  isConfigured(): boolean;
  /** Resolve the provider default voice for a locale (no DB access). */
  resolveVoiceId(params: {
    locale: SessionSpeechLocale;
    voiceId?: string | null;
    voiceIdAr?: string | null;
  }): string;
  synthesize(params: TtsSynthesizeParams): Promise<TtsSynthesizeResult>;
}

/** Wrap an already-materialized buffer as the single-chunk stream body. */
export function bufferToStream(
  buffer: ArrayBuffer,
): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
