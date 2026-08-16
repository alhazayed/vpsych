/**
 * The single TTS provider decision point.
 *
 * Mirrors `lib/ai/provider.ts` — exactly one module in the codebase chooses
 * which vendor a request goes to. Route handlers, the pipeline, and the
 * clinical layers never name a provider.
 *
 * Selection: `TTS_PROVIDER=google|elevenlabs`.
 * Default is `elevenlabs` so an unset variable keeps the pre-migration
 * behavior — Google is opt-in until benchmarking passes.
 *
 * There is deliberately NO automatic Google → ElevenLabs failover. A silent
 * provider switch would corrupt clinical benchmarking by hiding real Google
 * failures. When Google fails, the request fails and the existing client-side
 * browser-speech fallback takes over, which is visible in telemetry.
 */

import { elevenLabsService } from "@/lib/voice/elevenlabs";
import { googleTtsService } from "@/lib/voice/google";
import {
  isTtsProviderId,
  TtsError,
  TTS_PROVIDER_IDS,
  type TtsProvider,
  type TtsProviderId,
} from "@/lib/voice/tts/types";

export const DEFAULT_TTS_PROVIDER: TtsProviderId = "elevenlabs";

/**
 * Read the configured provider id.
 * An unset value defaults; an unrecognized value fails closed rather than
 * silently synthesizing with the wrong vendor.
 */
export function resolveTtsProviderId(): TtsProviderId {
  const raw = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_TTS_PROVIDER;
  if (isTtsProviderId(raw)) return raw;
  throw new TtsError("Text-to-speech provider misconfigured", {
    code: "TTS_CONFIG",
    status: 503,
    detail: `unknown TTS_PROVIDER; expected one of ${TTS_PROVIDER_IDS.join("|")}`,
  });
}

export function ttsProviderById(id: TtsProviderId): TtsProvider {
  return id === "google" ? googleTtsService : elevenLabsService;
}

/** The provider for this request. */
export function getTtsProvider(): TtsProvider {
  return ttsProviderById(resolveTtsProviderId());
}

/** Presence check for ops dashboards — never reports credential values. */
export function ttsProviderConfigured(id?: TtsProviderId): boolean {
  const provider = id ? ttsProviderById(id) : getTtsProvider();
  return provider.isConfigured();
}
