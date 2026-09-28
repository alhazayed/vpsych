/**
 * Streaming Audio Manager — chunk TTS/STT buffers with backpressure.
 */

import { createAudioBufferManager } from "@/lib/realtime/audio-buffer";
import { chunkTextForSpeechPlayback } from "@/lib/voice/speech-chunker";

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
  return chunkTextForSpeechPlayback(text, { maxChars, minChars: 1 });
}
