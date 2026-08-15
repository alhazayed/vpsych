/** Capture a short mono 16 kHz PCM WAV clip from the microphone (OpenAI STT-friendly). */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLen = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const start = Math.floor(i * ratio);
    result[i] = buffer[start] ?? 0;
  }
  return result;
}

export type MicRecorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** True once capture has stopped — by stop(), cancel(), or maxMs. */
  isStopped: () => boolean;
  /** True when capture ended because maxMs elapsed. */
  reachedMaxDuration: () => boolean;
};

export type MicRecorderOptions = {
  /** Fired when maxMs terminates capture, so the UI can finish the turn. */
  onMaxDuration?: () => void;
};

/**
 * Start recording from the default mic. Call stop() to get a WAV blob.
 * Uses ScriptProcessor for broad browser support.
 *
 * `maxMs` genuinely terminates capture. It previously scheduled an empty
 * callback, so a long turn buffered without bound until the STT upload cap
 * rejected it.
 */
export async function startMicWavRecording(
  maxMs = 15000,
  options: MicRecorderOptions = {},
): Promise<MicRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  // Captured up front: `sampleRate` must stay readable after the context is
  // closed by the max-duration timer.
  const sampleRate = audioContext.sampleRate;
  let stopped = false;
  let maxDurationReached = false;
  let cleanedUp = false;

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(timer);
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void audioContext.close();
  }

  const timer = window.setTimeout(() => {
    if (stopped) return;
    stopped = true;
    maxDurationReached = true;
    cleanup();
    options.onMaxDuration?.();
  }, maxMs);

  function encodeCaptured(): Blob {
    let length = 0;
    for (const c of chunks) length += c.length;
    const merged = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const down = downsample(merged, sampleRate, 16000);
    return encodeWav(down, 16000);
  }

  return {
    isStopped: () => stopped,
    reachedMaxDuration: () => maxDurationReached,
    cancel() {
      stopped = true;
      cleanup();
    },
    async stop() {
      stopped = true;
      cleanup();
      return encodeCaptured();
    },
  };
}
