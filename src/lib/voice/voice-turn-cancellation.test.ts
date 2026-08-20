import { afterEach, describe, expect, it, vi } from "vitest";
import { runVoiceConversationTurn } from "@/lib/voice/conversation-pipeline";

/**
 * Barge-in races on the RECORDER path (`toggleListen` → mic WAV → STT → reply).
 *
 * This is the path human QA exercised, and it was entirely uncancellable: the
 * caller passed no signal, so a therapist taking the floor mid-turn still got
 * the superseded transcript in the draft box, the superseded exchange appended
 * to the visible transcript, and the superseded reply spoken over them.
 *
 * `playback-cancellation.test.ts` covers cancellation *inside* playback. These
 * tests cover the three earlier stages, where an abort lands while a fetch is
 * already in flight and the response cannot be unmade.
 */

const WAV = () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });

const MESSAGE_BODY = {
  userMessage: {
    id: "u1",
    session_id: "s1",
    role: "user",
    content: "How have you been sleeping?",
    created_at: "2026-08-17T12:00:00.000Z",
  },
  assistantMessage: {
    id: "a1",
    session_id: "s1",
    role: "assistant",
    content: "ما بنام منيح.",
    created_at: "2026-08-17T12:00:02.000Z",
  },
  locale: "ar",
};

/** Route fetches by URL, holding the named stage open until released. */
function stagedFetch(gateOn: "transcribe" | "message" | null) {
  const urls: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => {
    release = r;
  });

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    urls.push(href);
    const stage = href.includes("/transcribe")
      ? "transcribe"
      : href.includes("/message")
        ? "message"
        : "tts";
    if (gateOn && stage === gateOn) await gate;

    // A real aborted fetch rejects; reproduce that rather than resolving.
    if (init?.signal?.aborted) {
      throw Object.assign(new Error("The operation was aborted."), {
        name: "AbortError",
      });
    }

    if (stage === "transcribe") {
      return Response.json({ transcript: "كيف نومك؟", provider: "openai" });
    }
    if (stage === "message") return Response.json(MESSAGE_BODY);
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:seg",
    revokeObjectURL: () => undefined,
  });
  vi.stubGlobal("window", { speechSynthesis: { cancel: () => undefined } });
  // Detached playback on an uninterrupted turn reaches the DOM audio element.
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    pause() {}
    play() {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Audio", FakeAudio);

  return { urls, release, fetchMock };
}

function baseParams() {
  return {
    sessionId: "s1",
    audio: WAV(),
    sessionLanguage: "ar-JO",
    locale: "ar" as const,
    voiceEnabled: true,
  };
}

describe("recorder turn — abort before any work", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("an already-aborted signal reaches neither STT nor the model", async () => {
    const { fetchMock } = stagedFetch(null);
    const abort = new AbortController();
    abort.abort();

    const result = await runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("interrupted");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("recorder turn — barge-in during STT", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not publish the superseded transcript to the draft box", async () => {
    const { release, urls } = stagedFetch("transcribe");
    const transcripts: string[] = [];

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
      onTranscript: (text) => transcripts.push(text),
    });

    abort.abort();
    release();
    const result = await running;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("interrupted");
    // The therapist has already started a new turn; the old words must not
    // reappear in the input they are about to speak into.
    expect(transcripts).toEqual([]);
    expect(urls.some((u) => u.includes("/message"))).toBe(false);
  });

  it("reports interruption rather than an STT failure", async () => {
    const { release } = stagedFetch("transcribe");

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
    });
    abort.abort();
    release();
    const result = await running;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // "stt" would put a transcription error in the status line for what was a
    // deliberate barge-in.
    expect(result.stage).not.toBe("stt");
    expect(result.unavailable).toBeUndefined();
  });
});

describe("recorder turn — barge-in during the model call", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not append the superseded exchange to the transcript", async () => {
    const { release } = stagedFetch("message");
    const appended: string[] = [];

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
      onMessages: (_user, assistant) => appended.push(assistant.content),
    });

    abort.abort();
    release();
    const result = await running;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("interrupted");
    // This is the "stale response" human QA reported: the reply to a question
    // the therapist has already moved on from.
    expect(appended).toEqual([]);
  });

  it("does not synthesize speech for the superseded reply", async () => {
    const { release, urls } = stagedFetch("message");

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
    });
    abort.abort();
    release();
    await running;

    // Give any detached playback a tick to have started if it were going to.
    await new Promise((r) => setTimeout(r, 0));
    expect(urls.some((u) => u.includes("/tts"))).toBe(false);
  });

  it("an aborted message fetch does not surface as a network error", async () => {
    const { release } = stagedFetch("message");

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
    });
    abort.abort();
    release();

    // The rejection is absorbed — the caller must not see a thrown AbortError,
    // which its catch block would render as "microphone/transcription error".
    await expect(running).resolves.toMatchObject({
      ok: false,
      stage: "interrupted",
    });
  });
});

describe("recorder turn — uninterrupted turns are unaffected", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes normally and speaks when the signal never aborts", async () => {
    const { release, urls } = stagedFetch("message");
    const appended: string[] = [];
    // Playback is detached from the returned promise, so wait on the handler.
    let spoken!: () => void;
    const finishedSpeaking = new Promise<void>((r) => {
      spoken = r;
    });

    const abort = new AbortController();
    const running = runVoiceConversationTurn({
      ...baseParams(),
      signal: abort.signal,
      onMessages: (_user, assistant) => appended.push(assistant.content),
      speakHandlers: { onend: () => spoken(), onerror: () => spoken() },
    });
    release();
    const result = await running;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript).toBe("كيف نومك؟");
    expect(appended).toEqual(["ما بنام منيح."]);
    expect(urls.some((u) => u.includes("/transcribe"))).toBe(true);
    expect(urls.some((u) => u.includes("/message"))).toBe(true);

    await finishedSpeaking;
    expect(urls.some((u) => u.includes("/tts"))).toBe(true);
  });

  it("still completes when no signal is supplied at all", async () => {
    const { release } = stagedFetch("message");
    const running = runVoiceConversationTurn({
      ...baseParams(),
      voiceEnabled: false,
    });
    release();
    await expect(running).resolves.toMatchObject({ ok: true });
  });
});
