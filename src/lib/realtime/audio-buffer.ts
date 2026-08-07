/**
 * Audio Buffer Manager — queues PCM/encoded chunks with drop policy.
 */

import type { AudioBufferStats } from "@/lib/realtime/types";

export type AudioChunk = {
  id: string;
  bytes: Uint8Array;
  ts: number;
};

export type AudioBufferManagerOptions = {
  maxQueuedBytes?: number;
};

export function createAudioBufferManager(
  opts: AudioBufferManagerOptions = {},
) {
  const maxQueuedBytes = opts.maxQueuedBytes ?? 512_000;
  const queue: AudioChunk[] = [];
  let queuedBytes = 0;
  let droppedChunks = 0;
  let underruns = 0;
  let overruns = 0;
  let seq = 0;

  return {
    enqueue(bytes: Uint8Array): AudioChunk | null {
      if (bytes.byteLength === 0) return null;
      while (
        queuedBytes + bytes.byteLength > maxQueuedBytes &&
        queue.length > 0
      ) {
        const dropped = queue.shift();
        if (dropped) {
          queuedBytes -= dropped.bytes.byteLength;
          droppedChunks += 1;
          overruns += 1;
        }
      }
      if (queuedBytes + bytes.byteLength > maxQueuedBytes) {
        droppedChunks += 1;
        overruns += 1;
        return null;
      }
      const chunk: AudioChunk = {
        id: `chunk-${++seq}`,
        bytes,
        ts: Date.now(),
      };
      queue.push(chunk);
      queuedBytes += bytes.byteLength;
      return chunk;
    },
    dequeue(): AudioChunk | null {
      const next = queue.shift() ?? null;
      if (!next) {
        underruns += 1;
        return null;
      }
      queuedBytes -= next.bytes.byteLength;
      return next;
    },
    clear() {
      queue.length = 0;
      queuedBytes = 0;
    },
    stats(): AudioBufferStats {
      return { queuedBytes, droppedChunks, underruns, overruns };
    },
    size() {
      return queue.length;
    },
  };
}
