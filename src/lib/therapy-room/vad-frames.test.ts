import { describe, expect, it } from "vitest";
import { createFrameRing, encodeCapturedFrames } from "./vad";

describe("barge-in pre-roll ring", () => {
  it("keeps at least maxSamples of the most recent audio, dropping oldest frames", () => {
    const ring = createFrameRing(4096);
    for (let i = 0; i < 10; i++) ring.push(new Float32Array(2048).fill(i));
    const frames = ring.snapshot();
    const total = frames.reduce((n, f) => n + f.length, 0);
    expect(total).toBeGreaterThanOrEqual(4096);
    expect(total).toBeLessThanOrEqual(4096 + 2048);
    // Newest frame is retained (the interruption's onset is not lost).
    expect(frames[frames.length - 1]![0]).toBe(9);
    expect(frames[0]![0]).toBeGreaterThanOrEqual(7);
  });

  it("after a barge-in fires the ring freezes and windows by timestamp", () => {
    const ring = createFrameRing(2048);
    for (let t = 1; t <= 4; t++) ring.push(new Float32Array(1024).fill(t), t * 100);
    ring.freeze();
    for (let t = 5; t <= 8; t++) ring.push(new Float32Array(1024).fill(t), t * 100);
    // Frozen: nothing evicted after detection.
    expect(ring.samples()).toBe(6 * 1024);
    // Lead-in trim (> 400) and de-dup cutoff (≤ 700).
    expect(ring.snapshotBetween(400, 700).map((f) => f[0])).toEqual([5, 6, 7]);
    expect(ring.snapshotUntil(600).map((f) => f[0])).toEqual([3, 4, 5, 6]);
  });

  it("a single oversize frame is never dropped", () => {
    const ring = createFrameRing(100);
    ring.push(new Float32Array(500));
    expect(ring.samples()).toBe(500);
  });
});

describe("encodeCapturedFrames", () => {
  it("encodes pre-roll + live frames into one 16 kHz WAV", async () => {
    const frames = [new Float32Array(48000).fill(0.1), new Float32Array(48000)];
    const wav = encodeCapturedFrames(frames, 48000);
    expect(wav.type).toBe("audio/wav");
    // 2 s @ 16 kHz mono 16-bit + 44-byte header.
    expect(wav.size).toBe(44 + 2 * 16000 * 2);
  });
});
