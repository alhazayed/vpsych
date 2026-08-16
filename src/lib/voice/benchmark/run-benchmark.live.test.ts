/**
 * GATED LIVE BENCHMARK RUNNER — makes real provider calls and costs money.
 *
 * Skipped unless `TTS_BENCHMARK=1`, so `npm test` and CI are unaffected.
 * This is the dev-only, server-only entry point for the controlled comparison;
 * it is not a route, not reachable from the browser, and not part of the app.
 *
 * Run:
 *   TTS_BENCHMARK=1 \
 *   GOOGLE_TTS_API_KEY=… ELEVENLABS_API_KEY=… \
 *   GOOGLE_TTS_ENABLE_SPEAKING_RATE=true \
 *   npx vitest run src/lib/voice/benchmark/run-benchmark.live.test.ts
 *
 * Optional narrowing:
 *   TTS_BENCHMARK_LOCALE=ar
 *   TTS_BENCHMARK_VOICES=ar-XA-Chirp3-HD-Kore,ar-XA-Chirp3-HD-Aoede
 *   TTS_BENCHMARK_PROVIDERS=google,elevenlabs
 */

import { describe, expect, it } from "vitest";
import {
  runTtsBenchmark,
  summarizeBenchmark,
  type BenchmarkResult,
} from "@/lib/voice/benchmark/harness";
import { benchmarkVoicesForLocale } from "@/lib/voice/google/voices";
import { resetTtsCache } from "@/lib/voice/tts/cache";
import type { TtsProviderId } from "@/lib/voice/tts/types";
import type { SessionSpeechLocale } from "@/lib/voice/config";

const ENABLED = process.env.TTS_BENCHMARK === "1";

function locale(): SessionSpeechLocale {
  return process.env.TTS_BENCHMARK_LOCALE === "en" ? "en" : "ar";
}

function providers(): TtsProviderId[] {
  const raw = process.env.TTS_BENCHMARK_PROVIDERS?.trim();
  if (!raw) return ["google", "elevenlabs"];
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is TtsProviderId => p === "google" || p === "elevenlabs");
}

function googleVoices(): string[] {
  const raw = process.env.TTS_BENCHMARK_VOICES?.trim();
  if (raw) return raw.split(",").map((v) => v.trim()).filter(Boolean);
  return benchmarkVoicesForLocale(locale()).map((v) => v.name);
}

function reportRow(r: BenchmarkResult): string {
  if (!r.ok) {
    return `${r.provider}\t${r.voice ?? "-"}\t${r.textId}\tFAILED\t${r.code}`;
  }
  return [
    r.provider,
    r.voice,
    r.textId,
    `synth=${r.synthesisMs}ms`,
    `total=${r.totalMs}ms`,
    `audio=${r.audioDurationMs ?? "?"}ms`,
    `bytes=${r.audioBytes}`,
    `cache=${r.cacheHit ? "hit" : "miss"}`,
    `rate=${r.speakingRateApplied ? (r.speakingRate ?? "on") : "off"}`,
    `pause=${r.pauseControlApplied ? r.pauseTagCount : "off"}`,
    `pron=${r.customPronunciationsApplied}`,
  ].join("\t");
}

describe.skipIf(!ENABLED)("live TTS benchmark", () => {
  it(
    "synthesizes the benchmark corpus across providers and voices",
    async () => {
      const selectedLocale = locale();
      const all: BenchmarkResult[] = [];

      for (const voice of googleVoices()) {
        // Cold cache per voice so latency reflects real synthesis.
        resetTtsCache();
        const batch = await runTtsBenchmark({
          providers: providers(),
          locale: selectedLocale,
          applyClinicalVoice: true,
          voiceByProvider: { google: voice },
        });
        all.push(...batch);
      }

      console.log(
        [
          "",
          "provider\tvoice\ttextId\tmetrics…",
          ...all.map(reportRow),
          "",
          "── summary ──",
          ...summarizeBenchmark(all).map(
            (s) =>
              `${s.provider}\t${s.voice}\truns=${s.runs}\tfail=${s.failures}\t` +
              `p50synth=${s.medianSynthesisMs ?? "?"}ms\tp50total=${s.medianTotalMs ?? "?"}ms\t` +
              `audio=${s.totalAudioMs}ms\trate=${s.speakingRateAppliedCount}\t` +
              `pause=${s.pauseControlAppliedCount}\tpron=${s.customPronunciationCount}`,
          ),
        ].join("\n"),
      );

      expect(all.length).toBeGreaterThan(0);
    },
    10 * 60 * 1000,
  );
});

describe("benchmark runner gating", () => {
  it("is opt-in so CI never makes paid provider calls", () => {
    // Guards the gate itself: if this constant is ever inverted, CI would
    // start billing on every run.
    expect(ENABLED).toBe(process.env.TTS_BENCHMARK === "1");
  });
});
