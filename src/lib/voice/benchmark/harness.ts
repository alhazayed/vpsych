/**
 * Server-only TTS benchmark harness.
 *
 * Synthesizes the same static, fictional VPsych dialogue through each provider
 * and records comparable, non-PHI measurements.
 *
 * PRIVACY CONTRACT — enforced by tests:
 * - Records reference a benchmark text by `textId` only. The dialogue itself is
 *   never stored in a record, and the corpus is fictional anyway.
 * - No patient identifiers, no session identifiers, no user identifiers, no
 *   avatar identifiers, no transcripts, no PHI of any kind.
 * - Audio is measured and discarded. It is retained in memory only when the
 *   caller explicitly passes `keepAudio: true`, and never written to disk here.
 * - Credentials are never read, echoed, or logged by this module.
 *
 * NOT wired to any route. NOT importable from client components. This exists to
 * be driven from a gated dev-only runner.
 */

import type {
  TtsProvider,
  TtsProviderId,
  TtsSynthesizeParams,
} from "@/lib/voice/tts/types";
import { TtsError } from "@/lib/voice/tts/types";
import { ttsProviderById } from "@/lib/voice/tts/provider";
import { estimateMp3Duration } from "@/lib/voice/benchmark/mp3-duration";
import {
  BENCHMARK_TEXTS,
  findBenchmarkText,
  type BenchmarkTextCase,
} from "@/lib/voice/benchmark/text-set";
import type { SessionSpeechLocale } from "@/lib/voice/config";

export type BenchmarkRecord = {
  /** Corpus id — never the dialogue itself. */
  textId: string;
  /** UTF-8 byte length of the input, useful for cost/limit analysis. */
  textBytes: number;
  provider: TtsProviderId;
  voice: string;
  locale: SessionSpeechLocale;
  model: string;
  contentType: string;

  /**
   * Provider call duration: request start → synthesize() resolved.
   * For Google (non-streaming REST) this is the full response.
   * For ElevenLabs (streaming) this is approximately time-to-first-byte.
   */
  synthesisMs: number;
  /** synthesize() resolved → response body fully drained. */
  transferMs: number;
  /** Request start → body fully drained. */
  totalMs: number;
  /** Duration of the rendered audio itself, not a latency measure. */
  audioDurationMs: number | null;
  audioBytes: number;

  streamed: boolean;
  cacheHit: boolean;

  speakingRateApplied: boolean;
  speakingRate: number | null;
  pauseControlApplied: boolean;
  pauseTagCount: number;
  customPronunciationsApplied: number;
  unsupportedSignals: string[];

  ok: true;
  /** Retained only when explicitly requested. */
  audio?: ArrayBuffer;
};

export type BenchmarkFailure = {
  textId: string;
  provider: TtsProviderId;
  voice: string | null;
  locale: SessionSpeechLocale;
  ok: false;
  /** Provider-neutral error code. Never the raw provider body. */
  code: string;
  status: number | null;
};

export type BenchmarkResult = BenchmarkRecord | BenchmarkFailure;

export type BenchmarkRunOptions = {
  providers?: TtsProviderId[];
  /** Restrict to specific corpus ids. */
  textIds?: string[];
  locale?: SessionSpeechLocale;
  /** Voice override per provider, e.g. one of BENCHMARK_VOICES. */
  voiceByProvider?: Partial<Record<TtsProviderId, string>>;
  /** Feed the corpus' clinical pace/pause characteristics through. */
  applyClinicalVoice?: boolean;
  /** Retain audio buffers on the record. Off by default. */
  keepAudio?: boolean;
  /** Injectable for tests. */
  resolveProvider?: (id: TtsProviderId) => TtsProvider;
  now?: () => number;
};

function selectTexts(options: BenchmarkRunOptions): BenchmarkTextCase[] {
  let texts: BenchmarkTextCase[] = [...BENCHMARK_TEXTS];
  if (options.textIds?.length) {
    texts = options.textIds
      .map((id) => findBenchmarkText(id))
      .filter((t): t is BenchmarkTextCase => t !== null);
  }
  if (options.locale) {
    texts = texts.filter((t) => t.locale === options.locale);
  }
  return texts;
}

function clinicalVoiceFor(
  text: BenchmarkTextCase,
  apply: boolean,
): TtsSynthesizeParams["clinicalVoice"] {
  if (!apply) return undefined;
  if (text.speechRate === undefined && text.pauseScale === undefined) {
    return undefined;
  }
  return {
    speech_rate: text.speechRate ?? null,
    pause_scale: text.pauseScale ?? null,
  };
}

/**
 * Run one provider/text pair and produce a single record.
 * Never throws — a provider failure becomes a `BenchmarkFailure` row so a run
 * across many voices completes and stays comparable.
 */
export async function benchmarkOne(params: {
  providerId: TtsProviderId;
  text: BenchmarkTextCase;
  voice?: string;
  applyClinicalVoice?: boolean;
  keepAudio?: boolean;
  resolveProvider?: (id: TtsProviderId) => TtsProvider;
  now?: () => number;
}): Promise<BenchmarkResult> {
  const now = params.now ?? (() => Date.now());
  const provider = (params.resolveProvider ?? ttsProviderById)(
    params.providerId,
  );
  const { text } = params;

  const request: TtsSynthesizeParams = {
    text: text.text,
    locale: text.locale,
    voiceId: params.voice ?? null,
    voiceIdAr: params.voice ?? null,
    clinicalVoice: clinicalVoiceFor(text, params.applyClinicalVoice === true),
  };

  const started = now();
  try {
    const result = await provider.synthesize(request);
    const synthesized = now();

    const audio = await new Response(result.body).arrayBuffer();
    const drained = now();

    const duration = estimateMp3Duration(audio);
    const diagnostics = result.diagnostics;

    return {
      textId: text.id,
      textBytes: Buffer.byteLength(text.text, "utf8"),
      provider: result.provider,
      voice: result.voiceId,
      locale: result.locale,
      model: result.modelId,
      contentType: result.contentType,

      synthesisMs: synthesized - started,
      transferMs: drained - synthesized,
      totalMs: drained - started,
      audioDurationMs: duration.durationMs,
      audioBytes: audio.byteLength,

      streamed: result.streamed,
      cacheHit: result.cached,

      speakingRateApplied: diagnostics?.speakingRateApplied ?? false,
      speakingRate: diagnostics?.speakingRate ?? null,
      pauseControlApplied: diagnostics?.pauseControlApplied ?? false,
      pauseTagCount: diagnostics?.pauseTagCount ?? 0,
      customPronunciationsApplied:
        diagnostics?.customPronunciationsApplied ?? 0,
      unsupportedSignals: diagnostics?.unsupportedSignals ?? [],

      ok: true,
      ...(params.keepAudio ? { audio } : {}),
    };
  } catch (error) {
    return {
      textId: text.id,
      provider: params.providerId,
      voice: params.voice ?? null,
      locale: text.locale,
      ok: false,
      // Provider-neutral code only — never the upstream body.
      code: error instanceof TtsError ? String(error.code) : "UNKNOWN",
      status: error instanceof TtsError ? error.status : null,
    };
  }
}

/** Run the corpus across the selected providers, sequentially. */
export async function runTtsBenchmark(
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkResult[]> {
  const providers = options.providers ?? ["google", "elevenlabs"];
  const texts = selectTexts(options);
  const results: BenchmarkResult[] = [];

  for (const providerId of providers) {
    for (const text of texts) {
      results.push(
        await benchmarkOne({
          providerId,
          text,
          voice: options.voiceByProvider?.[providerId],
          applyClinicalVoice: options.applyClinicalVoice,
          keepAudio: options.keepAudio,
          resolveProvider: options.resolveProvider,
          now: options.now,
        }),
      );
    }
  }

  return results;
}

export type BenchmarkSummary = {
  provider: TtsProviderId;
  voice: string;
  runs: number;
  failures: number;
  cacheHits: number;
  medianSynthesisMs: number | null;
  medianTotalMs: number | null;
  totalAudioMs: number;
  speakingRateAppliedCount: number;
  pauseControlAppliedCount: number;
  customPronunciationCount: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/** Aggregate records per provider+voice. Contains no dialogue and no PHI. */
export function summarizeBenchmark(
  results: BenchmarkResult[],
): BenchmarkSummary[] {
  const groups = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const voice = r.ok ? r.voice : (r.voice ?? "unknown");
    const key = `${r.provider} ${voice}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }

  const summaries: BenchmarkSummary[] = [];
  for (const [key, group] of groups) {
    const [provider, voice] = key.split(" ") as [TtsProviderId, string];
    const ok = group.filter((r): r is BenchmarkRecord => r.ok);

    summaries.push({
      provider,
      voice,
      runs: group.length,
      failures: group.length - ok.length,
      cacheHits: ok.filter((r) => r.cacheHit).length,
      medianSynthesisMs: median(ok.map((r) => r.synthesisMs)),
      medianTotalMs: median(ok.map((r) => r.totalMs)),
      totalAudioMs: ok.reduce((sum, r) => sum + (r.audioDurationMs ?? 0), 0),
      speakingRateAppliedCount: ok.filter((r) => r.speakingRateApplied).length,
      pauseControlAppliedCount: ok.filter((r) => r.pauseControlApplied).length,
      customPronunciationCount: ok.reduce(
        (sum, r) => sum + r.customPronunciationsApplied,
        0,
      ),
    });
  }

  return summaries;
}

/** Keys that must never appear on a benchmark record. Asserted by tests. */
export const FORBIDDEN_RECORD_KEYS: readonly string[] = [
  "text",
  "dialogue",
  "transcript",
  "sessionId",
  "session_id",
  "userId",
  "user_id",
  "patientId",
  "patient_id",
  "avatarId",
  "avatar_id",
  "apiKey",
  "accessToken",
  "authorization",
] as const;
