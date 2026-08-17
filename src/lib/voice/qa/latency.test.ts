import { describe, expect, it } from "vitest";
import {
  dominantStage,
  formatLatency,
  formatLatencyReport,
  summarizeLatency,
} from "@/lib/voice/qa/latency";
import type { VoiceQaMarks } from "@/lib/voice/qa/types";

/**
 * The arithmetic is trivial; the behaviour under missing marks is not. A turn
 * that was barged in, fell back to browser speech, or died at STT still gets a
 * partial trace, and a stage that never ran must read "—" rather than 0 ms.
 */

const FULL: VoiceQaMarks = {
  speech_ended: 1000,
  stt_final: 1720,
  llm_request: 1730,
  llm_response: 4140,
  speech_text_ready: 4220,
  tts_request: 4225,
  tts_first_audio: 5535,
  playback_start: 5520 + 20,
};

describe("summarizeLatency", () => {
  it("derives every stage from a complete set of marks", () => {
    const latency = summarizeLatency(FULL, 0);
    expect(latency.sttMs).toBe(720);
    expect(latency.llmMs).toBe(2410);
    expect(latency.speechTextMs).toBe(80);
    expect(latency.ttsFirstAudioMs).toBe(1310);
    expect(latency.totalMs).toBe(4540);
  });

  it("reports null — never zero — for a stage that never ran", () => {
    const latency = summarizeLatency({
      speech_ended: 1000,
      stt_final: 1500,
    });
    expect(latency.sttMs).toBe(500);
    // A zero here would read as "the model answered instantly".
    expect(latency.llmMs).toBeNull();
    expect(latency.ttsFirstAudioMs).toBeNull();
    expect(latency.totalMs).toBeNull();
  });

  it("returns null rather than a negative duration when marks invert", () => {
    expect(
      summarizeLatency({ speech_ended: 2000, stt_final: 1000 }).sttMs,
    ).toBeNull();
  });

  it("keeps the scripted thinking pause separate from TTS latency", () => {
    const latency = summarizeLatency(FULL, 900);
    expect(latency.thinkingPauseMs).toBe(900);
    // The pause must not be folded into the provider's number.
    expect(latency.ttsFirstAudioMs).toBe(1310);
  });

  it("handles an empty mark set", () => {
    const latency = summarizeLatency({});
    expect(Object.values(latency).every((v) => v === null)).toBe(true);
  });
});

describe("dominantStage", () => {
  it("names the slowest real stage", () => {
    expect(dominantStage(summarizeLatency(FULL, 0))).toEqual({
      stage: "LLM",
      ms: 2410,
    });
  });

  it("ignores the scripted thinking pause even when it is the largest span", () => {
    // A 6s product-chosen pause is not a latency problem to optimize.
    const latency = summarizeLatency(FULL, 6000);
    expect(dominantStage(latency)?.stage).toBe("LLM");
  });

  it("returns null when nothing was measured", () => {
    expect(dominantStage(summarizeLatency({}))).toBeNull();
  });
});

describe("formatting", () => {
  it("renders seconds to two places and dashes an absent stage", () => {
    expect(formatLatency(1310)).toBe("1.31 s");
    expect(formatLatency(0)).toBe("0.00 s");
    expect(formatLatency(null)).toBe("—");
  });

  it("produces the aligned report from the QA brief", () => {
    const report = formatLatencyReport(summarizeLatency(FULL, 80));
    expect(report).toContain("STT:");
    expect(report).toContain("0.72 s");
    expect(report).toContain("2.41 s");
    expect(report).toContain("1.31 s");
    expect(report).toContain("4.54 s");
  });
});
