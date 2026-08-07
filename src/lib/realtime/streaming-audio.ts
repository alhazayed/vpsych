/**
 * Streaming Audio Manager — chunk TTS/STT buffers with backpressure.
 */

import { createAudioBufferManager } from "@/lib/realtime/audio-buffer";

export type StreamingAudioManager = ReturnType<typeof createStreamingAudioManager>;

export function createStreamingAudioManager(opts?: {
  maxQueuedBytes?: number;
  highWaterMark?: number;
}) {
  const buffer = createAudioBufferManager({
    maxQueuedBytes: opts?.maxQueuedBytes,
  });
  const highWaterMark = opts?.highWaterMark ?? 96_000;
  let pausedForBackpressure = false;
  let bytesIn = 0;
  let bytesOut = 0;

  return {
    push(bytes: Uint8Array) {
      const chunk = buffer.enqueue(bytes);
      if (chunk) bytesIn += bytes.byteLength;
      const stats = buffer.stats();
      pausedForBackpressure = stats.queuedBytes >= highWaterMark;
      return { accepted: Boolean(chunk), backpressure: pausedForBackpressure };
    },
    pull() {
      const chunk = buffer.dequeue();
      if (chunk) bytesOut += chunk.bytes.byteLength;
      const stats = buffer.stats();
      pausedForBackpressure = stats.queuedBytes >= highWaterMark;
      return chunk;
    },
    shouldPauseProducer() {
      return pausedForBackpressure;
    },
    clear() {
      buffer.clear();
      pausedForBackpressure = false;
    },
    stats() {
      return {
        ...buffer.stats(),
        bytesIn,
        bytesOut,
        backpressure: pausedForBackpressure,
      };
    },
  };
}

/** Split text into speakable incremental chunks for progressive TTS. */
export function chunkTextForSpeech(
  text: string,
  maxChars: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const parts: string[] = [];
  const sentences = trimmed.split(/(?<=[.!?…。؟])\s+/);
  let buf = "";
  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((buf + " " + sentence).trim().length <= maxChars) {
      buf = (buf + " " + sentence).trim();
      continue;
    }
    if (buf) parts.push(buf);
    if (sentence.length <= maxChars) {
      buf = sentence;
    } else {
      for (let i = 0; i < sentence.length; i += maxChars) {
        parts.push(sentence.slice(i, i + maxChars));
      }
      buf = "";
    }
  }
  if (buf) parts.push(buf);
  return parts;
}
