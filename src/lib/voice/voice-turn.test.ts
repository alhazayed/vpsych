/**
 * One complete voice turn, stage by stage:
 *   recording → STT → transcript → /message → patient text → TTS → playback
 *
 * Browser APIs (Audio, URL object URLs, speechSynthesis) are faked so the real
 * client pipeline code runs unmodified in node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginVoiceTurn,
  describeAudioUnavailable,
  describeVoiceError,
  failVoiceStage,
  initialVoiceDiagnostics,
  isEmptyRecording,
  markAudioUnavailable,
  markVoiceStage,
  voiceTurnOutcome,
  wavDurationMs,
} from "@/lib/voice/voice-diagnostics";
import { sttProviderFailure } from "@/lib/voice/stt";
import { createConversationFsm } from "@/lib/therapy-room/conversation-fsm";
import type { PlaybackDiagnostic } from "@/lib/voice/conversation-pipeline";

function fakeWav(ms = 600): Blob {
  const samples = Math.round((16000 * ms) / 1000);
  return new Blob([new Uint8Array(44 + samples * 2)], { type: "audio/wav" });
}

const userMessage = {
  id: "u1",
  session_id: "s1",
  role: "user" as const,
  content: "Hello, how are you today?",
  created_at: "2026-10-03T12:00:00.000Z",
};
const assistantMessage = {
  id: "a1",
  session_id: "s1",
  role: "assistant" as const,
  content: "Not great, honestly.",
  created_at: "2026-10-03T12:00:02.000Z",
};

// ---------------------------------------------------------------------------
// Browser fakes
// ---------------------------------------------------------------------------

type AudioBehaviour = "plays" | "rejects-autoplay" | "decode-error";

const audioLog: string[] = [];
let audioBehaviour: AudioBehaviour = "plays";
const revoked: string[] = [];
let urlSeq = 0;

class FakeAudio {
  src: string;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  error: { code: number } | null = null;
  playbackRate = 1;
  volume = 1;
  constructor(src: string) {
    this.src = src;
    audioLog.push(`created:${src}`);
  }
  play(): Promise<void> {
    audioLog.push(`play:${this.src}`);
    if (revoked.includes(this.src)) {
      audioLog.push("PLAYED_REVOKED_URL");
    }
    if (audioBehaviour === "rejects-autoplay") {
      const err = new Error("play() blocked");
      err.name = "NotAllowedError";
      return Promise.reject(err);
    }
    if (audioBehaviour === "decode-error") {
      setTimeout(() => {
        this.error = { code: 4 };
        this.onerror?.();
      }, 0);
      return Promise.resolve();
    }
    setTimeout(() => {
      this.onplaying?.();
      setTimeout(() => this.onended?.(), 5);
    }, 0);
    return Promise.resolve();
  }
  pause() {
    audioLog.push("pause");
  }
  removeAttribute() {}
  load() {}
}

type SpeechBehaviour = "speaks" | "errors" | "never-starts" | "absent";
let speechBehaviour: SpeechBehaviour = "speaks";
const spokenLangs: string[] = [];

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e?: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const fakeSpeechSynthesis = {
  cancel: vi.fn(),
  speak: vi.fn((u: FakeUtterance) => {
    spokenLangs.push(u.lang);
    if (speechBehaviour === "speaks") {
      setTimeout(() => {
        u.onstart?.();
        setTimeout(() => u.onend?.(), 5);
      }, 0);
    } else if (speechBehaviour === "errors") {
      setTimeout(() => u.onerror?.({ error: "not-allowed" }), 0);
    }
    // never-starts: silently dropped (Chrome with no voice / no activation)
  }),
};

// Resolve timers at call time so vi.useFakeTimers() also drives window.*.
const timerFns = {
  setTimeout: (fn: () => void, ms?: number) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id?: ReturnType<typeof setTimeout>) =>
    globalThis.clearTimeout(id),
};

function installBrowserFakes() {
  audioLog.length = 0;
  revoked.length = 0;
  spokenLangs.length = 0;
  urlSeq = 0;
  fakeSpeechSynthesis.speak.mockClear();
  fakeSpeechSynthesis.cancel.mockClear();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal(
    "window",
    speechBehaviour === "absent"
      ? { ...timerFns, location: { search: "" } }
      : {
          speechSynthesis: fakeSpeechSynthesis,
          ...timerFns,
          location: { search: "" },
        },
  );
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:fake-${++urlSeq}`,
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => {
    revoked.push(u);
  });
}

function ttsAudioResponse(contentType = "audio/mpeg", bytes = 2048) {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

async function loadPipeline() {
  return import("@/lib/voice/conversation-pipeline");
}

beforeEach(() => {
  audioBehaviour = "plays";
  speechBehaviour = "speaks";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

describe("recording", () => {
  it("treats a header-only WAV as an empty recording and never uploads it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { transcribeTherapistSpeech } = await loadPipeline();
    const result = await transcribeTherapistSpeech({
      audio: new Blob([new Uint8Array(44)], { type: "audio/wav" }),
      locale: "en",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("EMPTY_RECORDING");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isEmptyRecording({ size: 0, type: "audio/wav" })).toBe(true);
  });

  it("accepts a valid non-empty WAV recording and reports its duration", () => {
    const wav = fakeWav(600);
    expect(isEmptyRecording(wav)).toBe(false);
    expect(wavDurationMs(wav.size)).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// STT
// ---------------------------------------------------------------------------

describe("STT", () => {
  it("returns the transcript with the multipart audio + locale contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("/api/voice/transcribe");
        const form = init?.body as FormData;
        expect((form.get("audio") as Blob).size).toBeGreaterThan(44);
        expect(form.get("locale")).toBe("en");
        return Response.json({
          transcript: "Hello, how are you today?",
          provider: "openai",
          model: "gpt-4o-mini-transcribe",
          locale: "en-US",
          language: "en",
        });
      }),
    );
    const { transcribeTherapistSpeech } = await loadPipeline();
    const result = await transcribeTherapistSpeech({
      audio: fakeWav(),
      locale: "en",
    });
    expect(result).toMatchObject({
      ok: true,
      transcript: "Hello, how are you today?",
    });
  });

  it("surfaces the real STT failure (HTTP 429 quota) instead of nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "Speech transcription failed: OpenAI quota exhausted",
            code: "OPENAI_QUOTA_EXHAUSTED",
          },
          { status: 429 },
        ),
      ),
    );
    const { transcribeTherapistSpeech } = await loadPipeline();
    const result = await transcribeTherapistSpeech({
      audio: fakeWav(),
      locale: "en",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
    expect(result.code).toBe("OPENAI_QUOTA_EXHAUSTED");
    expect(
      describeVoiceError({ stage: "stt", status: result.status, code: result.code }),
    ).toBe(
      "Speech-to-text failed (HTTP 429): OpenAI quota or credit balance is exhausted.",
    );
  });

  it("maps provider credit exhaustion to OPENAI_QUOTA_EXHAUSTED", () => {
    expect(
      sttProviderFailure({
        code: "OPENAI_RATE_LIMIT",
        kind: "rate_limit",
        status: 429,
        providerCode: "credit_balance_exhausted",
      }),
    ).toEqual({
      error: "Speech transcription failed: OpenAI quota exhausted",
      code: "OPENAI_QUOTA_EXHAUSTED",
      status: 429,
    });
    expect(
      sttProviderFailure({ code: "OPENAI_RATE_LIMIT", kind: "rate_limit", status: 429 })
        .code,
    ).toBe("OPENAI_RATE_LIMIT");
    expect(
      sttProviderFailure({ code: "OPENAI_AUTH", kind: "authentication", status: 401 })
        .code,
    ).toBe("OPENAI_AUTH");
  });

  it("forwards Arabic session language to STT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect((init?.body as FormData).get("locale")).toBe("ar");
        return Response.json({
          transcript: "مرحبا، كيف حالك اليوم؟",
          provider: "openai",
          language: "ar",
        });
      }),
    );
    const { transcribeTherapistSpeech } = await loadPipeline();
    const result = await transcribeTherapistSpeech({
      audio: fakeWav(),
      locale: "ar",
    });
    expect(result).toMatchObject({ ok: true, transcript: "مرحبا، كيف حالك اليوم؟" });
  });
});

// ---------------------------------------------------------------------------
// /message
// ---------------------------------------------------------------------------

describe("message API", () => {
  it("returns both messages and the AI source on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("/api/sessions/s1/message");
        expect(JSON.parse(String(init?.body))).toEqual({
          message: "Hello, how are you today?",
        });
        return Response.json({
          userMessage,
          assistantMessage,
          locale: "en",
          aiSource: "persona_fallback",
        });
      }),
    );
    const { submitConversationTurn } = await loadPipeline();
    const result = await submitConversationTurn({
      sessionId: "s1",
      message: "Hello, how are you today?",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.userMessage.id).toBe("u1");
    expect(result.data.assistantMessage.content).toBe("Not great, honestly.");
    expect(result.data.aiSource).toBe("persona_fallback");
  });

  it("returns the actual message-API failure, not a generic voice error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Failed to generate patient reply" }, { status: 502 }),
      ),
    );
    const { submitConversationTurn } = await loadPipeline();
    const result = await submitConversationTurn({ sessionId: "s1", message: "Hi" });
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: "Failed to generate patient reply",
    });
    if (result.ok) return;
    expect(
      describeVoiceError({
        stage: "message",
        status: result.status,
        message: result.error,
      }),
    ).toBe("Patient reply failed (HTTP 502): Failed to generate patient reply.");
  });
});

// ---------------------------------------------------------------------------
// Full turn: patient text never waits for (or depends on) TTS
// ---------------------------------------------------------------------------

describe("full voice turn", () => {
  it("delivers transcript and patient text even when TTS fails", async () => {
    speechBehaviour = "errors";
    installBrowserFakes();
    const order: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        order.push(String(url));
        if (url.includes("/transcribe")) {
          return Response.json({ transcript: "Hello, how are you today?" });
        }
        if (url.includes("/message")) {
          return Response.json({ userMessage, assistantMessage, locale: "en" });
        }
        return Response.json({ error: "Text-to-speech failed" }, { status: 401 });
      }),
    );
    const { runVoiceConversationTurn } = await loadPipeline();
    const seen: string[] = [];
    const result = await runVoiceConversationTurn({
      sessionId: "s1",
      audio: fakeWav(),
      locale: "en",
      voiceEnabled: true,
      onTranscript: (t) => seen.push(`transcript:${t}`),
      onMessages: (u, a) => seen.push(`messages:${u.id}:${a.id}`),
    });
    expect(result.ok).toBe(true);
    // Transcript first, then messages — both before any TTS completes.
    expect(seen).toEqual([
      "transcript:Hello, how are you today?",
      "messages:u1:a1",
    ]);
    expect(order[0]).toBe("/api/voice/transcribe");
    expect(order[1]).toBe("/api/sessions/s1/message");
  });
});

// ---------------------------------------------------------------------------
// TTS + playback
// ---------------------------------------------------------------------------

async function play(
  overrides: Partial<Parameters<
    Awaited<ReturnType<typeof loadPipeline>>["playPatientSpeech"]
  >[0]> = {},
) {
  const { playPatientSpeech } = await loadPipeline();
  const events: PlaybackDiagnostic[] = [];
  const unavailable: Array<{ code: string; status?: number }> = [];
  const mode = await playPatientSpeech({
    text: "Not great, honestly.",
    locale: "en",
    onDiagnostic: (e) => events.push(e),
    onUnavailable: (u) => unavailable.push(u),
    ...overrides,
  });
  return { mode, events: events.map((e) => e.event), unavailable };
}

describe("TTS and playback", () => {
  it("plays ElevenLabs audio to the end and revokes the URL only afterwards", async () => {
    installBrowserFakes();
    vi.stubGlobal("fetch", vi.fn(async () => ttsAudioResponse()));
    const { mode, events, unavailable } = await play();
    expect(mode).toBe("elevenlabs");
    expect(unavailable).toEqual([]);
    expect(events).toEqual([
      "tts_request_started",
      "tts_response",
      "audio_created",
      "audio_play_called",
      "audio_play_resolved",
      "audio_playing",
      "audio_ended",
    ]);
    expect(audioLog).not.toContain("PLAYED_REVOKED_URL");
    expect(revoked).toEqual(["blob:fake-1"]);
    expect(fakeSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("falls back to browser speech when ElevenLabs fails", async () => {
    installBrowserFakes();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "TTS_FAILED" }, { status: 401 })),
    );
    const { mode, events, unavailable } = await play();
    expect(mode).toBe("browser");
    expect(unavailable).toEqual([]);
    expect(events).toContain("browser_fallback_started");
    expect(events).toContain("browser_speech_started");
  });

  it("reports patient audio unavailable when ElevenLabs and browser speech both fail", async () => {
    speechBehaviour = "errors";
    installBrowserFakes();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "TTS_FAILED" }, { status: 401 })),
    );
    const { mode, unavailable } = await play();
    expect(mode).toBe("unavailable");
    expect(unavailable).toEqual([{ code: "TTS_FAILED", status: 401 }]);
  });

  it("never hangs when browser speech silently never starts", async () => {
    speechBehaviour = "never-starts";
    installBrowserFakes();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "TTS_UNAVAILABLE" }, { status: 501 })),
    );
    const pending = play();
    await vi.advanceTimersByTimeAsync(6000);
    const { mode, unavailable } = await pending;
    expect(mode).toBe("unavailable");
    expect(unavailable[0]?.code).toBe("TTS_UNAVAILABLE");
  });

  it("treats a 200 response without audio as a TTS failure", async () => {
    installBrowserFakes();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    const { mode, events } = await play();
    expect(mode).toBe("browser");
    expect(events).toContain("browser_fallback_started");
  });

  it("handles audio.play() rejection (autoplay blocked) explicitly", async () => {
    audioBehaviour = "rejects-autoplay";
    speechBehaviour = "errors";
    installBrowserFakes();
    vi.stubGlobal("fetch", vi.fn(async () => ttsAudioResponse()));
    const { mode, events, unavailable } = await play();
    expect(events).toContain("audio_play_rejected");
    expect(mode).toBe("unavailable");
    expect(unavailable).toEqual([{ code: "AUTOPLAY_BLOCKED", status: undefined }]);
  });

  it("falls back to browser speech on an audio decode error", async () => {
    audioBehaviour = "decode-error";
    installBrowserFakes();
    vi.stubGlobal("fetch", vi.fn(async () => ttsAudioResponse()));
    const { mode, events } = await play();
    expect(events).toContain("audio_error");
    expect(mode).toBe("browser");
  });

  it("AbortController cancellation stops playback and resolves interrupted", async () => {
    installBrowserFakes();
    vi.stubGlobal("fetch", vi.fn(async () => ttsAudioResponse()));
    const abort = new AbortController();
    const { playPatientSpeech } = await loadPipeline();
    const pending = playPatientSpeech({
      text: "Not great.",
      locale: "en",
      signal: abort.signal,
      onDiagnostic: (e) => {
        if (e.event === "audio_play_called") abort.abort();
      },
    });
    expect(await pending).toBe("interrupted");
    expect(audioLog).toContain("pause");
  });

  it("an already-aborted signal never starts TTS", async () => {
    installBrowserFakes();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const abort = new AbortController();
    abort.abort();
    const { mode } = await play({ signal: abort.signal });
    expect(mode).toBe("interrupted");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests Arabic TTS and uses an Arabic browser voice for Arabic turns", async () => {
    installBrowserFakes();
    const bodies: Array<{ locale?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ code: "TTS_FAILED" }, { status: 502 });
      }),
    );
    const { mode } = await play({ text: "مش منيح.", locale: "ar" });
    expect(bodies[0]?.locale).toBe("ar");
    expect(mode).toBe("browser");
    expect(spokenLangs[0]).toMatch(/^ar/);
  });
});

// ---------------------------------------------------------------------------
// Turn fencing — a successful turn must not cancel itself
// ---------------------------------------------------------------------------

describe("turn fencing", () => {
  it("keeps the same generation across a normal successful turn", () => {
    const fsm = createConversationFsm("IDLE");
    fsm.dispatch("START");
    const generation = fsm.getGeneration();
    for (const event of ["SPEECH_END", "STT_OK", "GPT_OK"] as const) {
      expect(fsm.dispatch(event).ok).toBe(true);
      expect(fsm.isCurrent(generation)).toBe(true);
    }
    expect(fsm.getState()).toBe("AVATAR_SPEAKING");
    expect(fsm.dispatch("PLAYBACK_END").ok).toBe(true);
    expect(fsm.isCurrent(generation)).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
  });

  it("marks the previous turn stale after barge-in / pause / unmount", () => {
    const fsm = createConversationFsm("IDLE");
    fsm.dispatch("START");
    const generation = fsm.getGeneration();
    fsm.dispatch("SPEECH_END");
    fsm.dispatch("STT_OK");
    fsm.dispatch("GPT_OK");
    fsm.dispatch("BARGE_IN");
    expect(fsm.isCurrent(generation)).toBe(false);
    const next = fsm.getGeneration();
    fsm.reset("IDLE");
    expect(fsm.isCurrent(next)).toBe(false);
  });

  it("an error recovers to listening via RETRY", () => {
    const fsm = createConversationFsm("IDLE");
    fsm.dispatch("START");
    fsm.dispatch("SPEECH_END");
    expect(fsm.dispatch("STT_FAIL").ok).toBe(true);
    expect(fsm.getState()).toBe("ERROR");
    expect(fsm.dispatch("RETRY").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
  });
});

// ---------------------------------------------------------------------------
// Diagnostics reducer — every turn ends SUCCESS, PARTIAL, or ERROR
// ---------------------------------------------------------------------------

describe("voice turn diagnostics", () => {
  function upToPatientText() {
    let d = beginVoiceTurn(initialVoiceDiagnostics());
    for (const s of ["mic", "recording", "stt", "transcript", "message", "patientText"] as const) {
      d = markVoiceStage(d, s, "ok");
    }
    return d;
  }

  it("SUCCESS when audio played", () => {
    const d = markVoiceStage(markVoiceStage(upToPatientText(), "tts", "ok"), "audio", "ok");
    expect(voiceTurnOutcome(d)).toBe("success");
  });

  it("PARTIAL when text is visible but audio is unavailable", () => {
    const d = markAudioUnavailable(upToPatientText(), {
      stage: "audio",
      code: "TTS_FAILED",
      status: 401,
      message: describeVoiceError({ stage: "audio", code: "TTS_FAILED", status: 401 }),
    });
    expect(voiceTurnOutcome(d)).toBe("partial");
    expect(d.stages.patientText).toBe("ok");
    expect(d.audioUnavailable?.message).toContain("HTTP 401");
  });

  it("names ElevenLabs vs browser playback in the audio-unavailable line", () => {
    expect(describeAudioUnavailable({ code: "TTS_FAILED", status: 401 })).toEqual({
      stage: "tts",
      message:
        "Patient voice (TTS) failed (HTTP 401): the ElevenLabs voice service returned an error. Browser speech fallback also failed.",
    });
    expect(describeAudioUnavailable({ code: "AUTOPLAY_BLOCKED" }).stage).toBe("audio");
  });

  it("ERROR names the failing stage", () => {
    const d = failVoiceStage(beginVoiceTurn(initialVoiceDiagnostics()), {
      stage: "message",
      status: 500,
      message: "Patient reply failed (HTTP 500): Failed to save reply.",
    });
    expect(voiceTurnOutcome(d)).toBe("error");
    expect(d.stages.message).toBe("fail");
  });

  it("a new turn resets stages but keeps the microphone status", () => {
    const d = beginVoiceTurn(markVoiceStage(initialVoiceDiagnostics(), "mic", "ok"));
    expect(d.turn).toBe(1);
    expect(d.stages.mic).toBe("ok");
    expect(d.stages.stt).toBe("idle");
    expect(d.error).toBeNull();
  });
});
