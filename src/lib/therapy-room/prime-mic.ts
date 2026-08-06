/**
 * Microphone priming for Therapy Room hands-free start.
 *
 * getUserMedia must run under a user gesture on Safari (and some Chrome /
 * Android builds) or it rejects with NotAllowedError. "Enter Therapy Room"
 * is that gesture — we acquire (and optionally stash) the stream there, then
 * the session page claims it so Listening can start without a second click.
 */

import { HANDS_FREE_AUDIO_CONSTRAINTS } from "./audio-constraints";

const HANDOFF_KEY = "__vpsychTherapyRoomMic";

type HandoffWindow = Window & {
  [HANDOFF_KEY]?: MediaStream;
};

/** True when at least one audio track is still live. */
export function mediaStreamIsLive(stream: MediaStream): boolean {
  return stream.getAudioTracks().some((t) => t.readyState === "live");
}

/**
 * Acquire a mic stream with preferred constraints, falling back to `{audio:true}`
 * when the device rejects exact AEC/NS/AGC/channelCount constraints (common on
 * Safari / some mobile browsers → OverconstrainedError).
 */
export async function acquireHandsFreeMicrophone(
  existing?: MediaStream | null,
): Promise<{ stream: MediaStream; ownsStream: boolean }> {
  if (existing && mediaStreamIsLive(existing)) {
    return { stream: existing, ownsStream: false };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "Media devices API unavailable",
      "NotSupportedError",
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: HANDS_FREE_AUDIO_CONSTRAINTS,
    });
    return { stream, ownsStream: true };
  } catch (preferredErr) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { stream, ownsStream: true };
    } catch {
      throw preferredErr;
    }
  }
}

/** Resume+close a short AudioContext so autoplay policies unlock under gesture. */
export async function unlockAudioContext(): Promise<void> {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    await ctx.close();
  } catch {
    /* best-effort */
  }
}

/**
 * Call from the Start Session click handler (user gesture) before navigation.
 * Stashes a live stream for TherapyRoomSession to claim.
 */
export async function primeTherapyRoomMicrophone(): Promise<void> {
  const { stream } = await acquireHandsFreeMicrophone();
  await unlockAudioContext();
  stashPrimedMicrophone(stream);
}

export function stashPrimedMicrophone(stream: MediaStream): void {
  if (typeof window === "undefined") return;
  const w = window as HandoffWindow;
  const prev = w[HANDOFF_KEY];
  if (prev && prev !== stream) {
    prev.getTracks().forEach((t) => t.stop());
  }
  w[HANDOFF_KEY] = stream;
}

/** Claim (and clear) a stream primed on the Start Session click. */
export function takePrimedMicrophone(): MediaStream | null {
  if (typeof window === "undefined") return null;
  const w = window as HandoffWindow;
  const stream = w[HANDOFF_KEY] ?? null;
  delete w[HANDOFF_KEY];
  if (stream && !mediaStreamIsLive(stream)) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  return stream;
}
