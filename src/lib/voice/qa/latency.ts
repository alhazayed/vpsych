/**
 * Latency arithmetic for a captured turn.
 *
 * Pure and separately testable, because the interesting part is not the
 * subtraction — it is what happens when marks are missing. A turn that was
 * barged in, fell back to browser speech, or failed at STT still produces a
 * partial trace, and reporting a bogus 0 ms for a stage that never ran would
 * be worse than reporting nothing.
 */

import type { VoiceQaLatency, VoiceQaMarks } from "@/lib/voice/qa/types";

function span(marks: VoiceQaMarks, from: keyof VoiceQaMarks, to: keyof VoiceQaMarks) {
  const a = marks[from];
  const b = marks[to];
  if (typeof a !== "number" || typeof b !== "number") return null;
  // Marks come from a monotonic clock, but a stage that never ran can leave the
  // pair inverted. Report nothing rather than a negative duration.
  const delta = b - a;
  return delta >= 0 ? Math.round(delta) : null;
}

export function summarizeLatency(
  marks: VoiceQaMarks,
  thinkingPauseMs: number | null = null,
): VoiceQaLatency {
  const ttsFirstAudioMs = span(marks, "tts_request", "tts_first_audio");
  return {
    sttMs: span(marks, "speech_ended", "stt_final"),
    llmMs: span(marks, "llm_request", "llm_response"),
    speechTextMs: span(marks, "llm_response", "speech_text_ready"),
    thinkingPauseMs,
    ttsFirstAudioMs,
    playbackStartMs: span(marks, "tts_first_audio", "playback_start"),
    totalMs: span(marks, "speech_ended", "playback_start"),
  };
}

/** Milliseconds → "1.31 s", or "—" when the stage did not run. */
export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * The QA panel's headline: which stage dominated this turn.
 *
 * The scripted thinking pause is excluded on purpose — it is a product
 * decision, not a latency problem, and letting it win would point tuning at
 * the wrong thing.
 */
export function dominantStage(
  latency: VoiceQaLatency,
): { stage: string; ms: number } | null {
  const candidates: Array<[string, number | null]> = [
    ["STT", latency.sttMs],
    ["LLM", latency.llmMs],
    ["Speech text", latency.speechTextMs],
    ["TTS first audio", latency.ttsFirstAudioMs],
    ["Playback start", latency.playbackStartMs],
  ];
  let best: { stage: string; ms: number } | null = null;
  for (const [stage, ms] of candidates) {
    if (ms === null) continue;
    if (!best || ms > best.ms) best = { stage, ms };
  }
  return best;
}

/** Human-readable block matching the format in the QA brief. */
export function formatLatencyReport(latency: VoiceQaLatency): string {
  const rows: Array<[string, number | null]> = [
    ["STT", latency.sttMs],
    ["LLM", latency.llmMs],
    ["Speech text", latency.speechTextMs],
    ["Thinking pause", latency.thinkingPauseMs],
    ["TTS first audio", latency.ttsFirstAudioMs],
    ["Playback start", latency.playbackStartMs],
    ["Total", latency.totalMs],
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  return rows
    .map(([label, ms]) => `${`${label}:`.padEnd(width)}${formatLatency(ms)}`)
    .join("\n");
}
