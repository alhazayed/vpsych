import { afterEach, describe, expect, it, vi } from "vitest";
import { playPatientSpeech } from "@/lib/voice/conversation-pipeline";
import { createVoiceQaStore } from "@/lib/voice/qa/store";

/**
 * The QA sink is only useful if the real pipeline actually drives it.
 *
 * Unit-testing the store proves the container works; these tests prove the
 * container is filled — by `playPatientSpeech` itself, with the audio it played
 * and the metadata the TTS route reported, not by a re-synthesis.
 */

function stubBrowser() {
  const objectUrls: string[] = [];
  vi.stubGlobal("URL", {
    createObjectURL: () => {
      const url = `blob:seg-${objectUrls.length}`;
      objectUrls.push(url);
      return url;
    },
    revokeObjectURL: () => undefined,
  });
  vi.stubGlobal("window", { speechSynthesis: { cancel: () => undefined } });
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    preload = "";
    src = "";
    pause() {}
    play() {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Audio", FakeAudio);
}

function stubTts(body = new Uint8Array([1, 2, 3, 4])) {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)).text as string);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Voice-Id": "pNInz6obpgDQGcFmaJgB",
          "X-Voice-Model": "eleven_multilingual_v2",
          "X-Voice-Locale": "ar",
          "X-Voice-Source": "env_default",
          "X-Voice-Cached": "0",
        },
      });
    }),
  );
  return bodies;
}

const TURN = "أنا *مش* مبسوط. بحس بضيق في صدري. فاهمني؟";

describe("playPatientSpeech drives the QA sink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("captures display text, speech text, segments, and the real audio", async () => {
    stubBrowser();
    stubTts();
    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");

    const mode = await playPatientSpeech({ text: TURN, locale: "ar", qa });
    expect(mode).toBe("elevenlabs");

    const turn = store.list()[0]!;
    // Display text is the clinical source of truth — verbatim, markers and all.
    expect(turn.displayText).toBe(TURN);
    // Speech text is what the provider was actually given.
    expect(turn.speechText).not.toBe(TURN);
    expect(turn.speechText).not.toContain("*");
    // ...and the negation survived into it.
    expect(turn.speechText).toContain("مش");
    expect(turn.speechChanged).toBe(true);
    expect(turn.segments.length).toBeGreaterThan(0);
    expect(turn.outcome).toBe("spoken");

    // Every segment carries the audio the app played, not a re-synthesis.
    for (const segment of turn.segments) {
      expect(segment.blob).toBeInstanceOf(Blob);
      expect(segment.byteLength).toBe(4);
      expect(segment.voiceId).toBe("pNInz6obpgDQGcFmaJgB");
      expect(segment.model).toBe("eleven_multilingual_v2");
      expect(segment.synthesisMs).not.toBeNull();
    }
  });

  it("captures the exact text sent to the provider, segment by segment", async () => {
    stubBrowser();
    const bodies = stubTts();
    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");

    await playPatientSpeech({ text: TURN, locale: "ar", qa });

    const captured = store.list()[0]!.segments.map((s) => s.text);
    expect(captured).toEqual(bodies);
  });

  it("records the latency marks the panel reports", async () => {
    stubBrowser();
    stubTts();
    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");

    await playPatientSpeech({ text: TURN, locale: "ar", qa });

    const turn = store.list()[0]!;
    expect(turn.marks.speech_text_ready).toBeDefined();
    expect(turn.marks.tts_request).toBeDefined();
    expect(turn.marks.tts_first_audio).toBeDefined();
    expect(turn.marks.playback_start).toBeDefined();
    expect(turn.latency.ttsFirstAudioMs).not.toBeNull();
  });

  it("reports the scripted thinking pause separately from TTS latency", async () => {
    stubBrowser();
    stubTts();
    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");

    await playPatientSpeech({
      text: "مرحبا.",
      locale: "ar",
      pauseBeforeMs: 40,
      qa,
    });

    expect(store.list()[0]!.latency.thinkingPauseMs).toBe(40);
  });

  it("records an interrupted turn as interrupted, with no audio", async () => {
    stubBrowser();
    stubTts();
    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");

    const abort = new AbortController();
    abort.abort();
    await playPatientSpeech({
      text: TURN,
      locale: "ar",
      signal: abort.signal,
      qa,
    });

    const turn = store.list()[0]!;
    expect(turn.outcome).toBe("interrupted");
    expect(turn.segments.every((s) => s.blob === null)).toBe(true);
  });

  it("records a provider failure as a browser fallback", async () => {
    stubBrowser();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    class Utterance {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      lang = "";
      rate = 1;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel: () => undefined,
        speak: (u: Utterance) => {
          u.onstart?.();
          u.onend?.();
        },
      },
    });

    const store = createVoiceQaStore();
    const qa = store.beginTurn("ar");
    await playPatientSpeech({ text: "مرحبا.", locale: "ar", qa });

    expect(store.list()[0]!.outcome).toBe("browser_fallback");
  });
});

describe("no sink means no capture and no extra retention", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("plays identically and records nothing when qa is absent", async () => {
    stubBrowser();
    stubTts();
    const store = createVoiceQaStore();

    const mode = await playPatientSpeech({ text: TURN, locale: "ar" });

    expect(mode).toBe("elevenlabs");
    expect(store.list()).toEqual([]);
  });
});
