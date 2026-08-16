import { describe, expect, it } from "vitest";
import {
  benchmarkOne,
  FORBIDDEN_RECORD_KEYS,
  runTtsBenchmark,
  summarizeBenchmark,
  type BenchmarkRecord,
} from "@/lib/voice/benchmark/harness";
import { estimateMp3Duration } from "@/lib/voice/benchmark/mp3-duration";
import {
  BENCHMARK_TEXTS,
  benchmarkTextsForLocale,
  coveredDimensions,
  findBenchmarkText,
} from "@/lib/voice/benchmark/text-set";
import {
  ARABIC_FEMALE_BENCHMARK_VOICES,
  ARABIC_MALE_BENCHMARK_VOICES,
  benchmarkVoicesForLocale,
  findBenchmarkVoice,
} from "@/lib/voice/google/voices";
import { isGoogleVoiceName } from "@/lib/voice/tts/voice-format";
import {
  bufferToStream,
  TtsError,
  type TtsProvider,
  type TtsProviderId,
} from "@/lib/voice/tts/types";

/**
 * Build a synthetic MPEG-1 Layer III frame stream so duration parsing can be
 * asserted deterministically without shipping a binary fixture.
 * 128 kbps @ 44100 Hz → 26.122 ms per frame, 417-byte frames.
 */
function fakeMp3(frames: number): ArrayBuffer {
  const FRAME_LEN = 417;
  const bytes = new Uint8Array(FRAME_LEN * frames);
  for (let f = 0; f < frames; f++) {
    const o = f * FRAME_LEN;
    bytes[o] = 0xff; // sync
    bytes[o + 1] = 0xfb; // MPEG-1, Layer III, no CRC
    bytes[o + 2] = 0x90; // 128 kbps, 44100 Hz, no padding
    bytes[o + 3] = 0x00;
  }
  return bytes.buffer;
}

function fakeProvider(
  id: TtsProviderId,
  overrides: Partial<{
    frames: number;
    voiceId: string;
    fail: TtsError;
    cached: boolean;
    speakingRate: number;
  }> = {},
): TtsProvider {
  return {
    id,
    isConfigured: () => true,
    resolveVoiceId: () => overrides.voiceId ?? "voice",
    async synthesize(params) {
      if (overrides.fail) throw overrides.fail;
      return {
        body: bufferToStream(fakeMp3(overrides.frames ?? 10)),
        contentType: "audio/mpeg",
        voiceId: params.voiceId ?? overrides.voiceId ?? "voice",
        locale: params.locale,
        modelId: "test-model",
        cached: overrides.cached ?? false,
        streamed: false,
        provider: id,
        diagnostics: {
          speakingRateApplied: overrides.speakingRate !== undefined,
          ...(overrides.speakingRate !== undefined
            ? { speakingRate: overrides.speakingRate }
            : {}),
          pitchApplied: false,
          pauseControlApplied: false,
          pauseTagCount: 0,
          customPronunciationsApplied: 0,
          unsupportedSignals: ["style:provider_has_no_equivalent"],
          textSanitized: false,
        },
      };
    },
  };
}

describe("benchmark text set", () => {
  it("is fictional, non-empty, and uniquely identified", () => {
    expect(BENCHMARK_TEXTS.length).toBeGreaterThan(0);
    const ids = new Set(BENCHMARK_TEXTS.map((t) => t.id));
    expect(ids.size).toBe(BENCHMARK_TEXTS.length);
    for (const t of BENCHMARK_TEXTS) {
      expect(t.text.trim().length).toBeGreaterThan(0);
      expect(t.dimensions.length).toBeGreaterThan(0);
    }
  });

  it("covers every Arabic quality dimension the benchmark must judge", () => {
    const covered = coveredDimensions();
    for (const dimension of [
      "jordanian_colloquial",
      "msa",
      "arabic_consonants",
      "medication_name",
      "psychiatric_terminology",
      "mixed_arabic_english",
      "numbers",
      "natural_pauses",
      "hesitation",
      "emotional_realism",
      "sentence_rhythm",
    ] as const) {
      expect(covered.has(dimension), dimension).toBe(true);
    }
  });

  it("includes a long Arabic response in the 20–30 second range", () => {
    const long = findBenchmarkText("ar-long-01");
    expect(long).not.toBeNull();
    // Arabic speech runs roughly 12–16 characters per second; ~300+ characters
    // lands in the intended 20–30s window.
    expect(long!.text.length).toBeGreaterThan(300);
  });

  it("filters by locale", () => {
    const arabic = benchmarkTextsForLocale("ar");
    expect(arabic.length).toBeGreaterThan(5);
    expect(arabic.every((t) => t.locale === "ar")).toBe(true);
  });

  it("contains no identifiers that could resemble real patient data", () => {
    for (const t of BENCHMARK_TEXTS) {
      expect(t.text).not.toMatch(/@/); // no emails
      expect(t.text).not.toMatch(/\b\d{9,}\b/); // no long id-like numbers
    }
  });
});

describe("benchmark voice catalogue", () => {
  it("offers the five Arabic female and five Arabic male candidates", () => {
    expect(ARABIC_FEMALE_BENCHMARK_VOICES.map((v) => v.name)).toEqual([
      "ar-XA-Chirp3-HD-Kore",
      "ar-XA-Chirp3-HD-Aoede",
      "ar-XA-Chirp3-HD-Achernar",
      "ar-XA-Chirp3-HD-Autonoe",
      "ar-XA-Chirp3-HD-Leda",
    ]);
    expect(ARABIC_MALE_BENCHMARK_VOICES.map((v) => v.name)).toEqual([
      "ar-XA-Chirp3-HD-Achird",
      "ar-XA-Chirp3-HD-Charon",
      "ar-XA-Chirp3-HD-Fenrir",
      "ar-XA-Chirp3-HD-Orus",
      "ar-XA-Chirp3-HD-Rasalgethi",
    ]);
  });

  it("every candidate is a well-formed Google voice name", () => {
    for (const voice of benchmarkVoicesForLocale("ar")) {
      expect(isGoogleVoiceName(voice.name), voice.name).toBe(true);
      expect(voice.languageCode).toBe("ar-XA");
    }
  });

  it("looks up a voice by name", () => {
    expect(findBenchmarkVoice("ar-XA-Chirp3-HD-Leda")?.gender).toBe("female");
    expect(findBenchmarkVoice("ar-XA-Chirp3-HD-Orus")?.gender).toBe("male");
    expect(findBenchmarkVoice("nope")).toBeNull();
  });
});

describe("estimateMp3Duration", () => {
  it("computes duration from MPEG frame headers", () => {
    // 10 frames × 1152 samples / 44100 Hz ≈ 261 ms
    const result = estimateMp3Duration(fakeMp3(10));
    expect(result.frameCount).toBe(10);
    expect(result.sampleRateHz).toBe(44100);
    expect(result.durationMs).toBe(261);
  });

  it("scales linearly with frame count", () => {
    expect(estimateMp3Duration(fakeMp3(40)).durationMs).toBe(1045);
  });

  it("returns null for input with no frames", () => {
    const result = estimateMp3Duration(new Uint8Array([0, 1, 2, 3]));
    expect(result.durationMs).toBeNull();
    expect(result.frameCount).toBe(0);
  });

  it("skips an ID3v2 tag before parsing", () => {
    const audio = new Uint8Array(fakeMp3(5));
    const tag = new Uint8Array(10 + 32);
    tag[0] = 0x49;
    tag[1] = 0x44;
    tag[2] = 0x33;
    tag[9] = 32; // synchsafe size
    const combined = new Uint8Array(tag.length + audio.length);
    combined.set(tag, 0);
    combined.set(audio, tag.length);

    expect(estimateMp3Duration(combined).frameCount).toBe(5);
  });
});

describe("benchmark harness", () => {
  const text = findBenchmarkText("ar-medication-01")!;

  it("records comparable measurements for a successful synthesis", async () => {
    let clock = 1000;
    const record = (await benchmarkOne({
      providerId: "google",
      text,
      voice: "ar-XA-Chirp3-HD-Kore",
      resolveProvider: () =>
        fakeProvider("google", { frames: 20, speakingRate: 0.85 }),
      now: () => (clock += 25),
    })) as BenchmarkRecord;

    expect(record.ok).toBe(true);
    expect(record.textId).toBe("ar-medication-01");
    expect(record.provider).toBe("google");
    expect(record.voice).toBe("ar-XA-Chirp3-HD-Kore");
    expect(record.locale).toBe("ar");
    expect(record.model).toBe("test-model");
    expect(record.audioDurationMs).toBe(522);
    expect(record.audioBytes).toBeGreaterThan(0);
    expect(record.synthesisMs).toBeGreaterThan(0);
    expect(record.totalMs).toBeGreaterThanOrEqual(record.synthesisMs);
    expect(record.cacheHit).toBe(false);
    expect(record.speakingRateApplied).toBe(true);
    expect(record.speakingRate).toBe(0.85);
    expect(record.unsupportedSignals).toContain(
      "style:provider_has_no_equivalent",
    );
  });

  it("never stores dialogue, identifiers, or credentials on a record", async () => {
    const record = await benchmarkOne({
      providerId: "google",
      text,
      resolveProvider: () => fakeProvider("google"),
    });

    const keys = Object.keys(record);
    for (const forbidden of FORBIDDEN_RECORD_KEYS) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    // The corpus text must not appear anywhere in the serialized record.
    expect(JSON.stringify(record)).not.toContain(text.text);
    // Only the stable id identifies the utterance.
    expect(JSON.stringify(record)).toContain("ar-medication-01");
  });

  it("discards audio unless explicitly asked to keep it", async () => {
    const dropped = (await benchmarkOne({
      providerId: "google",
      text,
      resolveProvider: () => fakeProvider("google"),
    })) as BenchmarkRecord;
    expect(dropped.audio).toBeUndefined();

    const kept = (await benchmarkOne({
      providerId: "google",
      text,
      keepAudio: true,
      resolveProvider: () => fakeProvider("google"),
    })) as BenchmarkRecord;
    expect(kept.audio).toBeInstanceOf(ArrayBuffer);
  });

  it("records a provider failure without leaking the upstream body", async () => {
    const failure = await benchmarkOne({
      providerId: "google",
      text,
      resolveProvider: () =>
        fakeProvider("google", {
          fail: new TtsError("Text-to-speech quota exceeded", {
            code: "TTS_QUOTA",
            status: 429,
            detail: "RESOURCE_EXHAUSTED: project quota for texttospeech",
          }),
        }),
    });

    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.code).toBe("TTS_QUOTA");
      expect(failure.status).toBe(429);
    }
    expect(JSON.stringify(failure)).not.toContain("RESOURCE_EXHAUSTED");
  });

  it("runs the corpus across both providers and keeps them separable", async () => {
    const results = await runTtsBenchmark({
      providers: ["google", "elevenlabs"],
      textIds: ["ar-conv-01", "ar-anxiety-01"],
      resolveProvider: (id) => fakeProvider(id, { voiceId: `${id}-voice` }),
    });

    expect(results).toHaveLength(4);
    expect(results.filter((r) => r.provider === "google")).toHaveLength(2);
    expect(results.filter((r) => r.provider === "elevenlabs")).toHaveLength(2);
  });

  it("passes the corpus clinical pace through only when asked", async () => {
    const seen: Array<number | null | undefined> = [];
    const probe: TtsProvider = {
      ...fakeProvider("google"),
      async synthesize(params) {
        seen.push(params.clinicalVoice?.speech_rate);
        return fakeProvider("google").synthesize(params);
      },
    };

    await benchmarkOne({
      providerId: "google",
      text: findBenchmarkText("ar-depression-01")!,
      resolveProvider: () => probe,
    });
    expect(seen[0]).toBeUndefined();

    await benchmarkOne({
      providerId: "google",
      text: findBenchmarkText("ar-depression-01")!,
      applyClinicalVoice: true,
      resolveProvider: () => probe,
    });
    expect(seen[1]).toBe(0.8);
  });

  it("summarizes per provider and voice", async () => {
    const results = await runTtsBenchmark({
      providers: ["google"],
      textIds: ["ar-conv-01", "ar-anxiety-01"],
      resolveProvider: () =>
        fakeProvider("google", { voiceId: "ar-XA-Chirp3-HD-Kore", frames: 10 }),
    });

    const summary = summarizeBenchmark(results);
    expect(summary).toHaveLength(1);
    expect(summary[0]!.provider).toBe("google");
    expect(summary[0]!.runs).toBe(2);
    expect(summary[0]!.failures).toBe(0);
    expect(summary[0]!.totalAudioMs).toBe(522);
    expect(summary[0]!.medianSynthesisMs).not.toBeNull();
  });

  it("keeps failures out of the latency medians", async () => {
    const results = await runTtsBenchmark({
      providers: ["google"],
      textIds: ["ar-conv-01"],
      resolveProvider: () =>
        fakeProvider("google", {
          fail: new TtsError("boom", { code: "TTS_FAILED", status: 502 }),
        }),
    });

    const summary = summarizeBenchmark(results);
    expect(summary[0]!.failures).toBe(1);
    expect(summary[0]!.medianSynthesisMs).toBeNull();
  });
});
