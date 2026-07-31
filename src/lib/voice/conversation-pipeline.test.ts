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
});
