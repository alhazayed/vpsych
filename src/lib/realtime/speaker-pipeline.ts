/**
 * Speaker Pipeline — playback queue with interrupt + volume normalization.
 */

export type SpeakerState = "idle" | "loading" | "playing" | "interrupted" | "error";

export type SpeakerChunk = {
  id: string;
  text?: string;
  audioUrl?: string;
  durationMsHint?: number;
};

export function createSpeakerPipeline(opts?: { volume?: number }) {
  let state: SpeakerState = "idle";
  let volume = clampVolume(opts?.volume ?? 1);
  const queue: SpeakerChunk[] = [];
  let current: SpeakerChunk | null = null;

  return {
    state: () => state,
    volume: () => volume,
    setVolume(v: number) {
      volume = clampVolume(v);
    },
    enqueue(chunk: SpeakerChunk) {
      queue.push(chunk);
      if (state === "idle") state = "loading";
    },
    beginPlay(chunk?: SpeakerChunk) {
      current = chunk ?? queue.shift() ?? null;
      state = current ? "playing" : "idle";
      return current;
    },
    interrupt() {
      queue.length = 0;
      current = null;
      state = "interrupted";
    },
    complete() {
      current = null;
      state = queue.length > 0 ? "loading" : "idle";
    },
    fail() {
      state = "error";
    },
    pending() {
      return queue.length;
    },
    current() {
      return current;
    },
  };
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1.5, Math.max(0, v));
}

/** Simple peak normalize scale for sample peaks in [-1,1]. */
export function normalizePeakScale(peak: number, target = 0.9): number {
  const p = Math.abs(peak);
  if (p < 1e-6) return 1;
  return Math.min(4, target / p);
}
