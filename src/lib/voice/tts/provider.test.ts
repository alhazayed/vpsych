import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TTS_PROVIDER,
  getTtsProvider,
  resolveTtsProviderId,
  ttsProviderById,
} from "@/lib/voice/tts/provider";
import { TtsError } from "@/lib/voice/tts/types";

describe("TTS provider selection", () => {
  afterEach(() => {
    delete process.env.TTS_PROVIDER;
  });

  it("defaults to ElevenLabs so an unset variable keeps pre-migration behavior", () => {
    delete process.env.TTS_PROVIDER;
    expect(DEFAULT_TTS_PROVIDER).toBe("elevenlabs");
    expect(resolveTtsProviderId()).toBe("elevenlabs");
    expect(getTtsProvider().id).toBe("elevenlabs");
  });

  it("selects Google when TTS_PROVIDER=google", () => {
    process.env.TTS_PROVIDER = "google";
    expect(resolveTtsProviderId()).toBe("google");
    expect(getTtsProvider().id).toBe("google");
  });

  it("selects ElevenLabs when TTS_PROVIDER=elevenlabs", () => {
    process.env.TTS_PROVIDER = "elevenlabs";
    expect(resolveTtsProviderId()).toBe("elevenlabs");
    expect(getTtsProvider().id).toBe("elevenlabs");
  });

  it("tolerates surrounding whitespace and casing", () => {
    process.env.TTS_PROVIDER = "  GOOGLE ";
    expect(resolveTtsProviderId()).toBe("google");
  });

  it("fails closed on an unknown provider rather than picking a vendor", () => {
    process.env.TTS_PROVIDER = "azure";
    expect(() => resolveTtsProviderId()).toThrow(TtsError);
    try {
      resolveTtsProviderId();
    } catch (err) {
      expect(err).toMatchObject({ code: "TTS_CONFIG", status: 503 });
    }
  });

  it("keeps the two providers isolated behind one shared interface", () => {
    const google = ttsProviderById("google");
    const eleven = ttsProviderById("elevenlabs");

    expect(google.id).toBe("google");
    expect(eleven.id).toBe("elevenlabs");
    expect(google).not.toBe(eleven);

    for (const provider of [google, eleven]) {
      expect(typeof provider.isConfigured).toBe("function");
      expect(typeof provider.resolveVoiceId).toBe("function");
      expect(typeof provider.synthesize).toBe("function");
    }
  });

  it("resolves provider-appropriate default voices, never the other vendor's", () => {
    expect(ttsProviderById("google").resolveVoiceId({ locale: "ar" })).toMatch(
      /^ar-XA-Chirp3-HD-/,
    );
    // ElevenLabs ids are opaque tokens, never locale-prefixed names.
    expect(
      ttsProviderById("elevenlabs").resolveVoiceId({ locale: "ar" }),
    ).not.toMatch(/^ar-XA-/);
  });
});
