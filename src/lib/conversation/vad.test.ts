import { describe, expect, it } from "vitest";
import {
  VoiceActivityDetector,
  analyzeVadFrame,
  clampSilenceMs,
} from "@/lib/conversation/vad";

function tone(freq: number, samples: number, amp = 0.2): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / 16000) * amp;
  }
  return out;
}

function silence(samples: number): Float32Array {
  return new Float32Array(samples);
}

function click(samples: number): Float32Array {
  const out = new Float32Array(samples);
  out[0] = 0.9;
  out[1] = -0.85;
  return out;
}

function fanNoise(samples: number, amp = 0.03): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = (Math.random() * 2 - 1) * amp;
  }
  return out;
}

describe("VAD", () => {
  it("clamps silence window to 600–900 ms", () => {
    expect(clampSilenceMs(100)).toBe(600);
    expect(clampSilenceMs(750)).toBe(750);
    expect(clampSilenceMs(2000)).toBe(900);
  });

  it("detects speech start and end after configurable silence", () => {
    const vad = new VoiceActivityDetector({
      minSilenceMs: 600,
      minSpeechMs: 50,
      sensitivity: 0.7,
      sampleRate: 16000,
    });
    const frame = 320; // 20ms at 16k
    const events: string[] = [];

    for (let i = 0; i < 20; i++) {
      const { events: ev } = vad.process(tone(180, frame, 0.25), 20);
      events.push(...ev.map((e) => e.type));
    }
    expect(events).toContain("speech_start");

    for (let i = 0; i < 40; i++) {
      const { events: ev } = vad.process(silence(frame), 20);
      events.push(...ev.map((e) => e.type));
    }
    expect(events).toContain("speech_end");
  });

  it("rejects short click / keyboard transients", () => {
    const analysis = analyzeVadFrame(click(64), { sensitivity: 0.55 });
    expect(analysis.rejectedTransient || !analysis.isSpeech).toBe(true);
  });

  it("treats fan-like noise as non-speech", () => {
    // Deterministic high-ZCR noise
    const frame = new Float32Array(512);
    for (let i = 0; i < frame.length; i++) {
      frame[i] = i % 2 === 0 ? 0.04 : -0.04;
    }
    const analysis = analyzeVadFrame(frame, { sensitivity: 0.4 });
    expect(analysis.isSpeech).toBe(false);
  });

  it("emits interruption when in interrupt mode", () => {
    const vad = new VoiceActivityDetector({
      minSpeechMs: 40,
      sensitivity: 0.75,
    });
    vad.setInterruptMode(true);
    const frame = 320;
    const events: string[] = [];
    for (let i = 0; i < 15; i++) {
      const { events: ev } = vad.process(tone(200, frame, 0.3), 20);
      events.push(...ev.map((e) => e.type));
    }
    expect(events).toContain("interruption");
  });

  it("does not end speech on timeout alone without silence analysis", () => {
    const vad = new VoiceActivityDetector({ minSilenceMs: 600 });
    // Continuous speech — no speech_end
    const events: string[] = [];
    for (let i = 0; i < 100; i++) {
      const { events: ev } = vad.process(tone(160, 320, 0.22), 20);
      events.push(...ev.map((e) => e.type));
    }
    expect(events).not.toContain("speech_end");
  });

  it("handles long pauses then speech (slow therapist)", () => {
    const vad = new VoiceActivityDetector({
      minSilenceMs: 800,
      minSpeechMs: 80,
      sensitivity: 0.7,
    });
    for (let i = 0; i < 50; i++) vad.process(silence(320), 20);
    const startEvents: string[] = [];
    for (let i = 0; i < 20; i++) {
      const { events } = vad.process(tone(170, 320, 0.25), 20);
      startEvents.push(...events.map((e) => e.type));
    }
    expect(startEvents).toContain("speech_start");
  });

  it("handles rapid speech bursts (fast therapist)", () => {
    const vad = new VoiceActivityDetector({
      minSilenceMs: 600,
      minSpeechMs: 40,
      sensitivity: 0.8,
    });
    const types: string[] = [];
    for (let burst = 0; burst < 3; burst++) {
      for (let i = 0; i < 10; i++) {
        const { events } = vad.process(tone(220, 320, 0.28), 20);
        types.push(...events.map((e) => e.type));
      }
      for (let i = 0; i < 35; i++) {
        const { events } = vad.process(silence(320), 20);
        types.push(...events.map((e) => e.type));
      }
    }
    expect(types.filter((t) => t === "speech_start").length).toBeGreaterThanOrEqual(2);
    expect(types.filter((t) => t === "speech_end").length).toBeGreaterThanOrEqual(2);
  });

  it("fanNoise helper stays below speech for low amp", () => {
    const analysis = analyzeVadFrame(fanNoise(1024, 0.015), {
      sensitivity: 0.3,
    });
    expect(analysis.isSpeech).toBe(false);
  });
});
