import { describe, expect, it } from "vitest";
import { ConversationController } from "@/lib/conversation/state-machine";
import { VoiceActivityDetector } from "@/lib/conversation/vad";

function speechFrame(n = 320, amp = 0.28): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((2 * Math.PI * 190 * i) / 16000) * amp;
  }
  return out;
}

function silenceFrame(n = 320): Float32Array {
  return new Float32Array(n);
}

describe("HFTE rapid interruption / deadlock guards", () => {
  it("survives rapid AvatarSpeaking ↔ Processing cycles", () => {
    const c = new ConversationController("Listening");
    for (let i = 0; i < 40; i++) {
      expect(c.tryTransition("Processing")).toBe(true);
      expect(c.tryTransition("AvatarSpeaking")).toBe(true);
      // interrupt
      expect(c.tryTransition("Processing")).toBe(true);
      expect(c.tryTransition("AvatarSpeaking")).toBe(true);
      expect(c.tryTransition("Listening")).toBe(true);
    }
    expect(c.getState()).toBe("Listening");
  });

  it("pause during every phase then resume without deadlock", () => {
    const phases = ["Listening", "Processing", "AvatarSpeaking"] as const;
    for (const phase of phases) {
      const c = new ConversationController("Listening");
      if (phase === "Processing" || phase === "AvatarSpeaking") {
        c.transition("Processing");
      }
      if (phase === "AvatarSpeaking") {
        c.transition("AvatarSpeaking");
      }
      expect(c.tryTransition("Paused")).toBe(true);
      expect(c.tryTransition("Listening")).toBe(true);
      expect(c.getState()).toBe("Listening");
    }
  });

  it("VAD interrupt then speech_end under bursty input", () => {
    const vad = new VoiceActivityDetector({
      minSpeechMs: 40,
      minSilenceMs: 600,
      sensitivity: 0.8,
    });
    vad.setInterruptMode(true);
    const types: string[] = [];
    for (let i = 0; i < 12; i++) {
      types.push(
        ...vad.process(speechFrame(), 20).events.map((e) => e.type),
      );
    }
    expect(types).toContain("interruption");
    vad.setInterruptMode(false);
    for (let i = 0; i < 10; i++) {
      types.push(
        ...vad.process(speechFrame(), 20).events.map((e) => e.type),
      );
    }
    for (let i = 0; i < 40; i++) {
      types.push(
        ...vad.process(silenceFrame(), 20).events.map((e) => e.type),
      );
    }
    expect(types).toContain("speech_end");
  });
});
