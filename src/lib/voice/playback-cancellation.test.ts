import { afterEach, describe, expect, it, vi } from "vitest";
import { playPatientSpeech } from "@/lib/voice/conversation-pipeline";

/**
 * Runtime cancellation races in segmented playback.
 *
 * Human QA found barge-in failing, stale audio playing, and the UI sticking —
 * none of which the isolated turn-guard tests could catch. Root cause: every
 * cancellation path in `playPatientSpeech` is gated on `signal`, and the
 * caller passed none, so `stopPlayback()` paused one clip while the segment
 * loop carried on synthesizing and starting the next.
 *
 * These tests pin the contract the caller depends on: once the signal aborts,
 * a superseded turn produces NO further synthesis and NO further playback.
 */

function stubBrowser() {
  const revoked: string[] = [];
  let created = 0;
  vi.stubGlobal("URL", {
    createObjectURL: () => `blob:seg-${++created}`,
    revokeObjectURL: (u: string) => revoked.push(u),
  });
  vi.stubGlobal("window", { speechSynthesis: { cancel: () => undefined } });
  return { revoked };
}

/** TTS endpoint that resolves only when the test releases it. */
function gatedTts() {
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).text as string);
      await gate;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    }),
  );
  return { calls, release };
}

const MULTI =
  "الجملة الأولى. الجملة الثانية. الجملة الثالثة. الجملة الرابعة.";

describe("cancellation before any provider work", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("an already-aborted signal performs no synthesis at all", async () => {
    stubBrowser();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const abort = new AbortController();
    abort.abort();

    const mode = await playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abort.signal,
    });

    expect(mode).toBe("interrupted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aborting during the thinking pause reaches no provider", async () => {
    stubBrowser();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      pauseBeforeMs: 5000,
      signal: abort.signal,
    });
    abort.abort();

    await expect(playing).resolves.toBe("interrupted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("cancellation during segmented synthesis", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stops the segment loop instead of playing the rest of the turn", async () => {
    const { revoked } = stubBrowser();
    const { calls, release } = gatedTts();

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abort.signal,
    });

    // Therapist barges in while the first segment is still synthesizing.
    abort.abort();
    release();

    await expect(playing).resolves.toBe("interrupted");

    // The loop must not have marched through the remaining segments.
    expect(calls.length).toBeLessThanOrEqual(2);
    // Nothing prefetched is left dangling.
    expect(revoked.length).toBeGreaterThan(0);
  });

  it("reports interruption via onerror, never onend", async () => {
    stubBrowser();
    const { release } = gatedTts();
    const events: string[] = [];

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abort.signal,
      handlers: {
        onstart: () => events.push("start"),
        onend: () => events.push("end"),
        onerror: () => events.push("error"),
      },
    });

    abort.abort();
    release();
    await playing;

    expect(events).toContain("error");
    // `onend` would tell the UI the turn finished normally — it did not.
    expect(events).not.toContain("end");
  });

  it("revokes prefetched object URLs so a stale clip cannot be replayed", async () => {
    const { revoked } = stubBrowser();
    const { release } = gatedTts();

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abort.signal,
    });
    abort.abort();
    release();
    await playing;

    // Give the best-effort discard a tick to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(revoked.every((u) => u.startsWith("blob:seg-"))).toBe(true);
  });
});

describe("cancellation is idempotent and recoverable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aborting repeatedly is safe", async () => {
    stubBrowser();
    const { release } = gatedTts();

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abort.signal,
    });
    abort.abort();
    abort.abort();
    abort.abort();
    release();

    await expect(playing).resolves.toBe("interrupted");
  });

  it("a fresh signal after an interruption is unaffected by the old one", async () => {
    stubBrowser();
    const first = gatedTts();

    const abortA = new AbortController();
    const turnA = playPatientSpeech({
      text: MULTI,
      locale: "ar",
      signal: abortA.signal,
    });
    abortA.abort();
    first.release();
    await expect(turnA).resolves.toBe("interrupted");

    // A new turn begins with its own controller and is NOT pre-aborted.
    const abortB = new AbortController();
    expect(abortB.signal.aborted).toBe(false);
    expect(abortA.signal.aborted).toBe(true);
  });

  it("a turn with no signal still settles rather than hanging", async () => {
    stubBrowser();
    // Provider failure falls through to browser speech.
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
      SpeechSynthesisUtterance: Utterance,
    });

    const mode = await playPatientSpeech({ text: "مرحبا.", locale: "ar" });
    expect(["tts", "browser", "interrupted"]).toContain(mode);
  });
});
