/**
 * Route-level tests for the daily patient-voice allowance on /api/voice/tts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/voice/tts/route";
import { resetRateLimitMemory } from "@/lib/rate-limit";
import {
  chargeDailyTtsChars,
  TTS_DAILY_CHARS,
  TTS_DAILY_LIMIT_CODE,
} from "@/lib/voice/tts-budget";
import {
  COURSE_VOICE_CHARS,
  TTS_COURSE_LIMIT_CODE,
} from "@/lib/voice/course-voice-budget";
import { normalizeSpeechLocale, previewSampleText } from "@/lib/voice/config";

const USER = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  synthesized: [] as string[],
  /** therapy_course_id of the trainee's active session (null: none). */
  activeCourse: null as string | null,
  /** What charge_course_voice answers. */
  courseCharged: true,
  rpcCalls: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({
        data: state.activeCourse ? { therapy_course_id: state.activeCourse } : null,
        error: null,
      }),
    };
    return {
      auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
      from: () => chain,
      rpc: async (_fn: string, args: unknown) => {
        state.rpcCalls.push(args);
        return { data: state.courseCharged, error: null };
      },
    };
  },
}));
vi.mock("@/lib/voice/resolve-tts-voice", () => ({
  resolveTtsVoice: async () => ({
    voiceId: "voice-1",
    source: "profile",
    clinicalProfile: null,
    voiceProfileId: null,
  }),
}));
vi.mock("@/lib/voice/elevenlabs", () => ({
  ElevenLabsError: class ElevenLabsError extends Error {},
  elevenLabsService: {
    synthesize: async ({ text }: { text: string }) => {
      state.synthesized.push(text);
      return {
        body: new Uint8Array([1, 2, 3]),
        contentType: "audio/mpeg",
        cached: false,
        voiceId: "voice-1",
        locale: "en-US",
        modelId: "m",
        streamed: false,
      };
    },
  },
}));

function tts(text: string, progressive = false) {
  return POST(
    new Request(
      `http://localhost/api/voice/tts${progressive ? "?progressive=1" : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, locale: "en-US" }),
      },
    ),
  );
}

beforeEach(() => {
  resetRateLimitMemory();
  state.synthesized = [];
  state.activeCourse = null;
  state.courseCharged = true;
  state.rpcCalls = [];
});
afterEach(() => resetRateLimitMemory());

describe("/api/voice/tts daily allowance", () => {
  it("speaks while the allowance lasts", async () => {
    const res = await tts("I haven't slept properly in weeks.");
    expect(res.status).toBe(200);
    expect(state.synthesized).toEqual(["I haven't slept properly in weeks."]);
  });

  it("refuses with TTS_DAILY_LIMIT once the day's characters are spent, without calling ElevenLabs", async () => {
    await chargeDailyTtsChars(USER, "x".repeat(TTS_DAILY_CHARS - 10));

    const over = await tts("This sentence is longer than ten characters.", true);
    expect(over.status).toBe(429);
    expect(Number(over.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await over.json()).toMatchObject({ code: TTS_DAILY_LIMIT_CODE });
    expect(state.synthesized).toEqual([]);

    // What is left of the allowance can still be spoken.
    const fits = await tts("Okay.", true);
    expect(fits.status).toBe(200);
    expect(state.synthesized).toEqual(["Okay."]);
  });

  it("does not charge a request the route rejects for length", async () => {
    await chargeDailyTtsChars(USER, "x".repeat(TTS_DAILY_CHARS - 500));
    const tooLong = await tts("y".repeat(401), true);
    expect(tooLong.status).toBe(400);
    expect((await tts("z".repeat(400), true)).status).toBe(200);
  });
});

describe("/api/voice/tts course allowance", () => {
  const COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("charges the active course and speaks while its allowance lasts", async () => {
    state.activeCourse = COURSE;
    const res = await tts("I keep waking at four.");
    expect(res.status).toBe(200);
    expect(state.rpcCalls).toEqual([
      { p_course_id: COURSE, p_chars: "I keep waking at four.".length, p_cap: COURSE_VOICE_CHARS },
    ]);
    expect(state.synthesized).toEqual(["I keep waking at four."]);
  });

  it("refuses with TTS_COURSE_LIMIT once the course's allowance is spent, without calling ElevenLabs", async () => {
    state.activeCourse = COURSE;
    state.courseCharged = false;
    const res = await tts("Some more of my story.", true);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: TTS_COURSE_LIMIT_CODE });
    expect(state.synthesized).toEqual([]);
  });

  it("does not touch a course when no course session is active", async () => {
    const res = await tts("Hello.");
    expect(res.status).toBe(200);
    expect(state.rpcCalls).toEqual([]);
  });

  it("speaks only the sample sentence for a preview, whatever text it carries", async () => {
    state.activeCourse = COURSE;
    const res = await POST(
      new Request("http://localhost/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          locale: "en-US",
          text: "A whole patient reply smuggled in as a preview.",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(state.synthesized).toEqual([previewSampleText(normalizeSpeechLocale("en-US"))]);
    expect(state.rpcCalls).toEqual([]);
  });
});
