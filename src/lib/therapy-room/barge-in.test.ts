import { describe, expect, it } from "vitest";
import { BARGE_IN_DEFAULTS, createBargeInDetector } from "./vad";

const FRAME_MS = 43; // 2048 samples @ 48 kHz

/** Feed `levels` one frame apart; return the elapsed ms at which it fired. */
function run(
  levels: number[],
  detector = createBargeInDetector(),
): number | null {
  let t = 1_000;
  for (const level of levels) {
    if (detector.push(level, t)) return t - 1_000;
    t += FRAME_MS;
  }
  return null;
}

const frames = (ms: number, level: number) =>
  Array.from({ length: Math.ceil(ms / FRAME_MS) }, () => level);

describe("createBargeInDetector", () => {
  it("never fires during calibration, however loud", () => {
    expect(run(frames(BARGE_IN_DEFAULTS.calibrationMs - FRAME_MS, 0.5))).toBeNull();
  });

  it("ignores the patient's own echo at a steady level", () => {
    // Residual echo well above the absolute threshold, as on laptop speakers.
    const echo = [...frames(450, 0.05), ...frames(3000, 0.06)];
    expect(run(echo)).toBeNull();
  });

  it("fires when the therapist speaks clearly over the echo", () => {
    const levels = [...frames(450, 0.04), ...frames(400, 0.04), ...frames(600, 0.2)];
    const at = run(levels);
    expect(at).not.toBeNull();
    // ≥ minSpeechMs after the therapist started at ~850 ms.
    expect(at!).toBeGreaterThanOrEqual(850 + BARGE_IN_DEFAULTS.minSpeechMs - FRAME_MS);
  });

  it("fires in a quiet room at the absolute threshold", () => {
    const levels = [...frames(450, 0.003), ...frames(500, 0.03)];
    expect(run(levels)).not.toBeNull();
  });

  it("does not fire on a short cough or click", () => {
    const levels = [
      ...frames(450, 0.01),
      ...frames(150, 0.3),
      ...frames(600, 0.01),
    ];
    expect(run(levels)).toBeNull();
  });

  it("tolerates short dips between syllables", () => {
    const syllables: number[] = [...frames(450, 0.01)];
    for (let i = 0; i < 6; i++) {
      syllables.push(...frames(100, 0.15), 0.01); // one-frame dip
    }
    expect(run(syllables)).not.toBeNull();
  });

  it("fires only once", () => {
    const d = createBargeInDetector();
    const levels = [...frames(450, 0.01), ...frames(2000, 0.3)];
    let fires = 0;
    let t = 0;
    for (const l of levels) {
      if (d.push(l, t)) fires += 1;
      t += FRAME_MS;
    }
    expect(fires).toBe(1);
  });

  it("learns the echo floor from the loud end of calibration", () => {
    const d = createBargeInDetector();
    let t = 0;
    for (const l of [...frames(225, 0.01), ...frames(225, 0.08)]) {
      d.push(l, t);
      t += FRAME_MS;
    }
    d.push(0.01, t); // first post-calibration frame computes the floor
    expect(d.echoFloor()).toBeGreaterThan(0.05);
  });
});
