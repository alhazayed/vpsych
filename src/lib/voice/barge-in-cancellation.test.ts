import { afterEach, describe, expect, it, vi } from "vitest";
import { playPatientSpeech } from "@/lib/voice/conversation-pipeline";
import {
  createConversationFsm,
  micAllowed,
  playbackAllowed,
} from "@/lib/therapy-room/conversation-fsm";

/**
 * Barge-in must survive the TTS provider swap.
 *
 * These tests exercise the EXISTING cancellation mechanism only — the
 * conversation FSM's generation counter plus the AbortSignal threaded through
 * `playPatientSpeech`. Nothing here modifies endpointing, VAD, or the FSM; the
 * point is to prove the provider-neutral TTS layer still honors both.
 */

function stubBrowserAudioEnv() {
  const revoked: string[] = [];
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:patient-audio",
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  vi.stubGlobal("window", { speechSynthesis: { cancel: () => undefined } });
  return revoked;
}

/** A TTS response that never resolves until the test releases it. */
function stubSlowTts(): { release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await gate;
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    }),
  );
  return { release };
}

describe("therapist barge-in cancels patient speech", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns interrupted without requesting audio when already aborted", async () => {
    stubBrowserAudioEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const abort = new AbortController();
    abort.abort(); // therapist already speaking

    const mode = await playPatientSpeech({
      text: "I have been feeling low for weeks.",
      locale: "en",
      signal: abort.signal,
    });

    expect(mode).toBe("interrupted");
    // No provider call at all — barge-in short-circuits before synthesis.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aborts during the thinking pause without reaching the provider", async () => {
    stubBrowserAudioEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: "Give me a moment.",
      locale: "en",
      pauseBeforeMs: 4000,
      signal: abort.signal,
    });

    // Therapist starts talking during the patient's thinking pause.
    abort.abort();

    await expect(playing).resolves.toBe("interrupted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("discards synthesized audio and revokes its object URL when barge-in lands mid-synthesis", async () => {
    const revoked = stubBrowserAudioEnv();
    const { release } = stubSlowTts();

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: "I did not sleep at all last night.",
      locale: "en",
      signal: abort.signal,
    });

    // Therapist barges in while the provider is still synthesizing.
    abort.abort();
    release();

    await expect(playing).resolves.toBe("interrupted");
    // Stale patient audio must never play, and its blob must be released.
    expect(revoked).toContain("blob:patient-audio");
  });

  it("reports the interruption through onerror, never onend", async () => {
    stubBrowserAudioEnv();
    const { release } = stubSlowTts();
    const events: string[] = [];

    const abort = new AbortController();
    const playing = playPatientSpeech({
      text: "It is hard to explain.",
      locale: "en",
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
    // `onend` would tell the FSM the turn completed normally — it did not.
    expect(events).not.toContain("end");
  });

  it("invalidates the in-flight generation so a stale turn cannot resume", async () => {
    const fsm = createConversationFsm("AVATAR_SPEAKING");
    const speakingGeneration = fsm.getGeneration();
    expect(playbackAllowed(fsm.getState())).toBe(true);

    // Therapist barges in: the FSM moves back to listening and bumps the
    // generation, so the completion of the old playback is no longer current.
    const transitioned = fsm.dispatch("BARGE_IN");
    expect(transitioned.ok).toBe(true);
    expect(fsm.isCurrent(speakingGeneration)).toBe(false);
    expect(fsm.isCurrent(fsm.getGeneration())).toBe(true);

    // Mic reopens immediately; playback is no longer permitted.
    expect(micAllowed(fsm.getState())).toBe(true);
    expect(playbackAllowed(fsm.getState())).toBe(false);
  });

  it("keeps a stale generation invalid after the interrupted playback settles", async () => {
    stubBrowserAudioEnv();
    const { release } = stubSlowTts();

    const fsm = createConversationFsm("AVATAR_SPEAKING");
    const generation = fsm.getGeneration();
    const abort = new AbortController();

    const playing = playPatientSpeech({
      text: "I keep replaying it.",
      locale: "en",
      signal: abort.signal,
    });

    // Barge-in: cancel playback AND invalidate the generation, exactly as
    // TherapyRoomSession does.
    abort.abort();
    fsm.dispatch("BARGE_IN");
    release();

    await expect(playing).resolves.toBe("interrupted");

    // The turn that was speaking can no longer claim ownership, so its late
    // completion cannot restart patient audio.
    expect(fsm.isCurrent(generation)).toBe(false);
    expect(fsm.getState()).toBe("LISTENING");
  });
});
