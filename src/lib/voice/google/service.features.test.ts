import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleTtsService } from "@/lib/voice/google";
import { resetTtsCache, ttsCacheSize } from "@/lib/voice/tts/cache";

/**
 * Benchmark-feature coverage for the Google adapter: pace control, pause
 * markup, and custom pronunciations — each gated by capability AND enablement.
 */

const GOOGLE_ENV = [
  "GOOGLE_TTS_API_KEY",
  "GOOGLE_TTS_ACCESS_TOKEN",
  "GOOGLE_TTS_VOICE_EN",
  "GOOGLE_TTS_VOICE_AR",
  "GOOGLE_TTS_LANGUAGE_EN",
  "GOOGLE_TTS_LANGUAGE_AR",
  "GOOGLE_TTS_TIMEOUT_MS",
  "GOOGLE_TTS_ENABLE_SPEAKING_RATE",
  "GOOGLE_TTS_ENABLE_PAUSE_CONTROL",
  "GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION",
] as const;

const AUDIO_B64 = Buffer.from([0xff, 0xfb, 0x90, 0x44]).toString("base64");

type SentBody = {
  input: {
    text?: string;
    markup?: string;
    customPronunciations?: {
      pronunciations: Array<{
        phrase: string;
        phoneticEncoding: string;
        pronunciation: string;
      }>;
    };
  };
  voice: { languageCode: string; name: string };
  audioConfig: Record<string, unknown>;
};

function stubFetch(): { bodies: SentBody[] } {
  const bodies: SentBody[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as SentBody);
      return new Response(JSON.stringify({ audioContent: AUDIO_B64 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return { bodies };
}

describe("Google adapter — benchmark features", () => {
  beforeEach(() => {
    resetTtsCache();
    for (const key of GOOGLE_ENV) delete process.env[key];
    process.env.GOOGLE_TTS_API_KEY = "test-key";
  });

  afterEach(() => {
    resetTtsCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of GOOGLE_ENV) delete process.env[key];
  });

  // ── Pace control ──────────────────────────────────────────────────────
  describe("speaking_rate", () => {
    it("is omitted when the feature is disabled (conservative default)", async () => {
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "Hello",
        locale: "en",
        clinicalVoice: { speech_rate: 0.8 },
      });

      expect(bodies[0]!.audioConfig).toEqual({ audioEncoding: "MP3" });
      expect(result.diagnostics?.speakingRateApplied).toBe(false);
      expect(result.diagnostics?.unsupportedSignals).toContain(
        "speech_rate:not_enabled",
      );
    });

    it("is sent when enabled", async () => {
      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "Hello",
        locale: "en",
        clinicalVoice: { speech_rate: 0.8 },
      });

      expect(bodies[0]!.audioConfig).toEqual({
        audioEncoding: "MP3",
        speakingRate: 0.8,
      });
      expect(result.diagnostics?.speakingRateApplied).toBe(true);
      expect(result.diagnostics?.speakingRate).toBe(0.8);
    });

    it("applies to Arabic ar-XA Chirp 3 HD as well", async () => {
      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "ما عاد في إشي بفرحني مثل قبل.",
        locale: "ar",
        clinicalVoice: { speech_rate: 0.75 },
      });

      expect(bodies[0]!.voice.languageCode).toBe("ar-XA");
      expect(bodies[0]!.audioConfig.speakingRate).toBe(0.75);
      expect(result.diagnostics?.speakingRateApplied).toBe(true);
    });

    it("clamps to Google's documented range", async () => {
      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({
        text: "Hello",
        locale: "en",
        clinicalVoice: { speech_rate: 9 },
      });
      expect(bodies[0]!.audioConfig.speakingRate).toBe(2);
    });

    it("never sends pitch to a Chirp 3 HD voice, even with rate enabled", async () => {
      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "Hello",
        locale: "en",
        clinicalVoice: { speech_rate: 0.8, pitch: 1.4 },
      });

      expect(bodies[0]!.audioConfig.pitch).toBeUndefined();
      expect(result.diagnostics?.pitchApplied).toBe(false);
      expect(result.diagnostics?.unsupportedSignals).toContain(
        "pitch:voice_rejects_parameter",
      );
    });
  });

  // ── Pause control ─────────────────────────────────────────────────────
  describe("pause control", () => {
    it("uses input.text and adds no tags when disabled", async () => {
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "First. Second. Third.",
        locale: "en",
        clinicalVoice: { pause_scale: 1.8 },
      });

      expect(bodies[0]!.input.text).toBe("First. Second. Third.");
      expect(bodies[0]!.input.markup).toBeUndefined();
      expect(result.diagnostics?.pauseControlApplied).toBe(false);
      expect(result.diagnostics?.unsupportedSignals).toContain(
        "pause_scale:not_enabled",
      );
    });

    it("switches to input.markup with pause tags when enabled", async () => {
      process.env.GOOGLE_TTS_ENABLE_PAUSE_CONTROL = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "First. Second. Third.",
        locale: "en",
        clinicalVoice: { pause_scale: 1.8 },
      });

      expect(bodies[0]!.input.text).toBeUndefined();
      expect(bodies[0]!.input.markup).toBe(
        "First. [pause long] Second. [pause long] Third.",
      );
      expect(result.diagnostics?.pauseControlApplied).toBe(true);
      expect(result.diagnostics?.pauseTagCount).toBe(2);
    });

    it("applies pause markup to Arabic dialogue at sentence boundaries", async () => {
      process.env.GOOGLE_TTS_ENABLE_PAUSE_CONTROL = "true";
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({
        text: "بصراحة، مش عارف كيف أشرحلك الموضوع. ما بعرف من وين أبدأ.",
        locale: "ar",
        clinicalVoice: { pause_scale: 1.7 },
      });

      const markup = bodies[0]!.input.markup!;
      expect(markup).toContain("الموضوع. [pause long] ما بعرف");
      // The Arabic comma is untouched.
      expect(markup).toContain("بصراحة، مش عارف");
    });

    it("neutralizes markup injected through clinical dialogue", async () => {
      process.env.GOOGLE_TTS_ENABLE_PAUSE_CONTROL = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "I am fine [pause long] really. Second one. Third one.",
        locale: "en",
        clinicalVoice: { pause_scale: 1.8 },
      });

      const markup = bodies[0]!.input.markup!;
      expect(markup).toContain("(pause long)");
      expect(markup.match(/\[pause long\]/g)).toHaveLength(2);
      expect(result.diagnostics?.textSanitized).toBe(true);
    });

    it("sanitizes brackets even when pause control is disabled", async () => {
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "I am fine [pause long] really.",
        locale: "en",
      });

      expect(bodies[0]!.input.text).toBe("I am fine (pause long) really.");
      expect(result.diagnostics?.textSanitized).toBe(true);
    });
  });

  // ── Custom pronunciations ─────────────────────────────────────────────
  describe("custom pronunciations", () => {
    it("sends none when disabled", async () => {
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "أنا حالياً باخذ سيرترالين.",
        locale: "ar",
      });

      expect(bodies[0]!.input.customPronunciations).toBeUndefined();
      expect(result.diagnostics?.customPronunciationsApplied).toBe(0);
    });

    it("sends matching entries when enabled", async () => {
      process.env.GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION = "true";
      const { bodies } = stubFetch();
      const result = await googleTtsService.synthesize({
        text: "أنا حالياً باخذ سيرترالين، بس مش ملتزم فيه كل يوم.",
        locale: "ar",
      });

      const sent = bodies[0]!.input.customPronunciations!.pronunciations;
      expect(sent.map((p) => p.phrase)).toContain("سيرترالين");
      expect(sent[0]!.phoneticEncoding).toBe("PHONETIC_ENCODING_IPA");
      expect(result.diagnostics!.customPronunciationsApplied).toBeGreaterThan(0);
    });

    it("sends nothing when no dictionary phrase occurs in the text", async () => {
      process.env.GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION = "true";
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({
        text: "منذ متى وأنت تشعر بهذه الأعراض؟",
        locale: "ar",
      });
      expect(bodies[0]!.input.customPronunciations).toBeUndefined();
    });

    it("never alters the spoken text when applying pronunciations", async () => {
      process.env.GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION = "true";
      const utterance = "بحس إنه عندي anxiety طول الوقت.";
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({ text: utterance, locale: "ar" });

      expect(bodies[0]!.input.text).toBe(utterance);
    });
  });

  // ── Cache isolation across the new knobs ──────────────────────────────
  describe("cache isolation", () => {
    it("does not reuse a no-rate render for a rate-applied request", async () => {
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({
        text: "Hello patient",
        locale: "en",
        clinicalVoice: { speech_rate: 0.8 },
      });
      expect(ttsCacheSize()).toBe(1);

      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      const second = await googleTtsService.synthesize({
        text: "Hello patient",
        locale: "en",
        clinicalVoice: { speech_rate: 0.8 },
      });

      expect(second.cached).toBe(false);
      expect(bodies).toHaveLength(2);
    });

    it("does not reuse a plain-text render for a markup request", async () => {
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({
        text: "First. Second. Third.",
        locale: "en",
        clinicalVoice: { pause_scale: 1.8 },
      });

      process.env.GOOGLE_TTS_ENABLE_PAUSE_CONTROL = "true";
      const second = await googleTtsService.synthesize({
        text: "First. Second. Third.",
        locale: "en",
        clinicalVoice: { pause_scale: 1.8 },
      });

      expect(second.cached).toBe(false);
      expect(bodies).toHaveLength(2);
      expect(bodies[1]!.input.markup).toBeDefined();
    });

    it("does not reuse a render across different pronunciation sets", async () => {
      const { bodies } = stubFetch();
      const utterance = "أنا حالياً باخذ سيرترالين.";
      await googleTtsService.synthesize({ text: utterance, locale: "ar" });

      process.env.GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION = "true";
      const second = await googleTtsService.synthesize({
        text: utterance,
        locale: "ar",
      });

      expect(second.cached).toBe(false);
      expect(bodies).toHaveLength(2);
    });

    it("does reuse an identical request", async () => {
      process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
      process.env.GOOGLE_TTS_ENABLE_PAUSE_CONTROL = "true";
      const { bodies } = stubFetch();

      const params = {
        text: "First. Second. Third.",
        locale: "en" as const,
        clinicalVoice: { speech_rate: 0.8, pause_scale: 1.8 },
      };
      await googleTtsService.synthesize(params);
      const second = await googleTtsService.synthesize(params);

      expect(second.cached).toBe(true);
      expect(bodies).toHaveLength(1);
    });

    it("isolates renders across different voices", async () => {
      process.env.GOOGLE_TTS_VOICE_AR = "ar-XA-Chirp3-HD-Kore";
      const { bodies } = stubFetch();
      await googleTtsService.synthesize({ text: "مرحبا", locale: "ar" });

      process.env.GOOGLE_TTS_VOICE_AR = "ar-XA-Chirp3-HD-Leda";
      const second = await googleTtsService.synthesize({
        text: "مرحبا",
        locale: "ar",
      });

      expect(second.cached).toBe(false);
      expect(second.voiceId).toBe("ar-XA-Chirp3-HD-Leda");
      expect(bodies).toHaveLength(2);
    });
  });

  // ── Voice switching across the benchmark catalogue ────────────────────
  describe("voice switching", () => {
    it("honors each Arabic benchmark candidate", async () => {
      const { bodies } = stubFetch();
      const voices = [
        "ar-XA-Chirp3-HD-Aoede",
        "ar-XA-Chirp3-HD-Achernar",
        "ar-XA-Chirp3-HD-Orus",
        "ar-XA-Chirp3-HD-Rasalgethi",
      ];

      for (const voice of voices) {
        const result = await googleTtsService.synthesize({
          text: "مرحبا",
          locale: "ar",
          voiceIdAr: voice,
        });
        expect(result.voiceId).toBe(voice);
      }

      expect(bodies.map((b) => b.voice.name)).toEqual(voices);
      expect(bodies.every((b) => b.voice.languageCode === "ar-XA")).toBe(true);
    });
  });
});
