import { describe, expect, it, vi, afterEach } from "vitest";
import { resolvePipelineLocale } from "@/lib/voice/conversation-pipeline";

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

    const { submitConversationTurn } = await import(
      "@/lib/voice/conversation-pipeline"
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

    const { transcribeTherapistSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const result = await transcribeTherapistSpeech({
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "ar-JO",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript).toContain("كيف");
  });

  it("runVoiceConversationTurn skips TTS when voiceEnabled is false", async () => {
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

    const { runVoiceConversationTurn } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const result = await runVoiceConversationTurn({
      sessionId: "s1",
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "en",
      voiceEnabled: false,
    });

    expect(result.ok).toBe(true);
    // Only STT + message — no /api/voice/tts call
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/transcribe"))).toBe(true);
    expect(urls.some((u) => u.includes("/message"))).toBe(true);
    expect(urls.some((u) => u.includes("/tts"))).toBe(false);
  });

  it("playPatientSpeech returns interrupted without creating Audio when aborted during TTS", async () => {
    const abort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        abort.abort();
        // Simulate fetch noticing the abort
        if (init?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }),
    );

    const AudioMock = vi.fn();
    vi.stubGlobal("Audio", AudioMock);

    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const onstart = vi.fn();
    const mode = await playPatientSpeech({
      text: "Hello from the patient",
      locale: "en",
      signal: abort.signal,
      handlers: { onstart },
    });

    expect(mode).toBe("interrupted");
    expect(AudioMock).not.toHaveBeenCalled();
    expect(onstart).not.toHaveBeenCalled();
  });

  it("playPatientSpeech creates Audio unmuted and calls onstart after play() resolves", async () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(mp3, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );

    const play = vi.fn(async () => undefined);
    const audioInstance = {
      muted: true,
      volume: 0,
      playbackRate: 0.5,
      play,
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const AudioMock = vi.fn(() => audioInstance);
    vi.stubGlobal("Audio", AudioMock);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock-tts"),
      revokeObjectURL: vi.fn(),
    });

    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const onstart = vi.fn(() => {
      expect(audioInstance.muted).toBe(false);
      expect(audioInstance.volume).toBe(1);
    });
    const onend = vi.fn();

    const done = playPatientSpeech({
      text: "I have been tired",
      locale: "en",
      handlers: { onstart, onend },
    });

    // Allow play().then(onstart) to run
    await vi.waitFor(() => expect(onstart).toHaveBeenCalledTimes(1));
    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(audioInstance.muted).toBe(false);

    audioInstance.onended?.();
    await expect(done).resolves.toBe("elevenlabs");
    expect(onend).toHaveBeenCalledTimes(1);
  });
});
