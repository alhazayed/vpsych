import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  createVoiceTurnFence,
  playPatientSpeech,
  resolvePipelineLocale,
  runVoiceConversationTurn,
  submitConversationTurn,
  transcribeTherapistSpeech,
} from "@/lib/voice/conversation-pipeline";
import { synthesizeSpeech } from "@/lib/voice/client";

describe("resolvePipelineLocale", () => {
  it("maps session.language to en | ar for the pipeline", () => {
    expect(resolvePipelineLocale("en-US")).toBe("en");
    expect(resolvePipelineLocale("ar-JO")).toBe("ar");
    expect(resolvePipelineLocale("ar")).toBe("ar");
    expect(resolvePipelineLocale(null, "en")).toBe("en");
  });
});

describe("conversation pipeline stages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("submitConversationTurn persists both messages with timestamps", async () => {
    const userMessage = {
      id: "u1",
      session_id: "s1",
      role: "user" as const,
      content: "How are you feeling?",
      created_at: "2026-07-31T12:00:00.000Z",
    };
    const assistantMessage = {
      id: "a1",
      session_id: "s1",
      role: "assistant" as const,
      content: "I've been exhausted lately.",
      created_at: "2026-07-31T12:00:02.000Z",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          userMessage,
          assistantMessage,
          remainingSeconds: 2300,
          locale: "en",
        }),
      ),
    );

    const result = await submitConversationTurn({
      sessionId: "s1",
      message: "How are you feeling?",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.userMessage.created_at).toBeTruthy();
    expect(result.data.assistantMessage.created_at).toBeTruthy();
    expect(result.data.userMessage.content).toContain("feeling");
    expect(result.data.assistantMessage.role).toBe("assistant");
  });

  it("Test 3 — therapist interruption sends therapistInterrupted: true", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        userMessage: {
          id: "u1",
          session_id: "s1",
          role: "user",
          content: "Sorry — go on",
          created_at: "2026-07-31T12:00:00.000Z",
        },
        assistantMessage: {
          id: "a1",
          session_id: "s1",
          role: "assistant",
          content: "It's fine.",
          created_at: "2026-07-31T12:00:01.000Z",
        },
        locale: "en",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitConversationTurn({
      sessionId: "s1",
      message: "Sorry — go on",
      therapistInterrupted: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1]?.body ?? "{}"));
    expect(body.therapistInterrupted).toBe(true);
    expect(body.message).toBe("Sorry — go on");
  });

  it("transcribeTherapistSpeech forwards session language for Arabic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const form = init?.body as FormData;
        expect(form.get("locale")).toBe("ar-JO");
        return Response.json({
          transcript: "كيف حالك",
          provider: "openai",
          language: "ar",
        });
      }),
    );

    const result = await transcribeTherapistSpeech({
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "ar-JO",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript).toContain("كيف");
  });

  it("Test 7 — runVoiceConversationTurn skips TTS when voiceEnabled is false", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/transcribe")) {
        return Response.json({
          transcript: "Hello",
          provider: "openai",
        });
      }
      return Response.json({
        userMessage: {
          id: "u1",
          session_id: "s1",
          role: "user",
          content: "Hello",
          created_at: "2026-07-31T12:00:00.000Z",
        },
        assistantMessage: {
          id: "a1",
          session_id: "s1",
          role: "assistant",
          content: "Hi there",
          created_at: "2026-07-31T12:00:01.000Z",
        },
        locale: "en",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runVoiceConversationTurn({
      sessionId: "s1",
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "en",
      voiceEnabled: false,
    });

    expect(result.ok).toBe(true);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/transcribe"))).toBe(true);
    expect(urls.some((u) => u.includes("/message"))).toBe(true);
    expect(urls.some((u) => u.includes("/tts"))).toBe(false);
  });
});

describe("Phase 9.1 — TTS cancellation + turn fencing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("Test 4 — AbortSignal during TTS does not fall back to browser speech", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const pending = synthesizeSpeech({
      text: "Hello patient",
      locale: "en",
      signal: controller.signal,
    });
    controller.abort();
    const result = await pending;
    expect(result.mode).toBe("interrupted");
    expect(result.objectUrl).toBeUndefined();
  });

  it("Test 2 — old TTS completing after interruption never plays", async () => {
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const audioInstance = {
      play: playSpy,
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: typeof audioInstance) {
        Object.assign(this, audioInstance);
        return this;
      }),
    );

    let resolveBlob: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveBlob = resolve;
          }),
      ),
    );

    const speakPromise = playPatientSpeech({
      text: "Old patient reply",
      locale: "en",
      turn: { turnId, isActive: (id) => fence.isActive(id) },
    });

    // Supersede the turn before TTS body arrives.
    fence.beginTurn();
    resolveBlob(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

    const mode = await speakPromise;
    expect(mode).toBe("interrupted");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("Test 6 — natural completion still plays when turn stays active", async () => {
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    });

    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );

    const mode = await playPatientSpeech({
      text: "Natural reply",
      locale: "en",
      turn: { turnId, isActive: (id) => fence.isActive(id) },
    });
    expect(mode).toBe("elevenlabs");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 1+8 — superseded turn after message cannot update UI or start TTS", async () => {
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const onMessages = vi.fn();

    let resolveMessage: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/transcribe")) {
        return Response.json({
          transcript: "Hello",
          provider: "openai",
        });
      }
      return new Promise<Response>((resolve) => {
        resolveMessage = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = runVoiceConversationTurn({
      sessionId: "s1",
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "en",
      voiceEnabled: true,
      turn: { turnId, isActive: (id) => fence.isActive(id) },
      onMessages,
    });

    // Newer therapist turn starts while message is in flight.
    fence.beginTurn();

    resolveMessage(
      Response.json({
        userMessage: {
          id: "u-old",
          session_id: "s1",
          role: "user",
          content: "Hello",
          created_at: "2026-07-31T12:00:00.000Z",
        },
        assistantMessage: {
          id: "a-old",
          session_id: "s1",
          role: "assistant",
          content: "Stale patient reply",
          created_at: "2026-07-31T12:00:01.000Z",
        },
        locale: "en",
      }),
    );

    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("cancelled");
    expect(onMessages).not.toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/tts"))).toBe(false);
  });

  it("Test 5 — only newest active turn can drive voice state callbacks", async () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    const t2 = fence.beginTurn();
    const events: string[] = [];

    const apply = (turnId: number, label: string) => {
      if (!fence.isActive(turnId)) return;
      events.push(label);
    };

    apply(t1, "t1-speaking");
    apply(t2, "t2-speaking");
    expect(events).toEqual(["t2-speaking"]);
  });

  it("AbortSignal on submitConversationTurn returns aborted without throwing", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const pending = submitConversationTurn({
      sessionId: "s1",
      message: "hi",
      signal: controller.signal,
    });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.aborted).toBe(true);
  });
});

describe("Phase 9.1 — synthesizeSpeech abort contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak: vi.fn(),
    });
  });

  it("does not attach objectUrl when aborted after headers arrive", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        return new Response(new Uint8Array([9, 9, 9]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }),
    );

    const result = await synthesizeSpeech({
      text: "late",
      locale: "en",
      signal: controller.signal,
    });
    expect(result.mode).toBe("interrupted");
    expect(result.objectUrl).toBeUndefined();
  });
});
