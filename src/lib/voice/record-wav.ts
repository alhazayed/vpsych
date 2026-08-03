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
  /** True after max duration auto-stop or explicit stop/cancel. */
  isStopped: () => boolean;
};

/**
 * Start recording from the default mic. Call stop() to get a WAV blob.
 * Uses ScriptProcessor for broad browser support.
 *
 * The processor is routed through a muted GainNode so the Web Audio graph
 * stays alive without playing live mic monitoring into the speakers (echo).
 * Recording auto-stops collecting after `maxMs`.
 */
export async function startMicWavRecording(
  maxMs = 15000,
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
  // Keep the graph running without audible mic feedback.
  const mute = audioContext.createGain();
  mute.gain.value = 0;
  const chunks: Float32Array[] = [];
  let stopped = false;

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  const timer = window.setTimeout(() => {
    // Auto-cap capture length; caller still invokes stop() for the blob.
    stopped = true;
  }, maxMs);

  function cleanup() {
    window.clearTimeout(timer);
    try {
      processor.disconnect();
      mute.disconnect();
      source.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void audioContext.close();
  }

  return {
    isStopped() {
      return stopped;
    },
    cancel() {
      stopped = true;
      cleanup();
    },
    async stop() {
      stopped = true;
      const sampleRate = audioContext.sampleRate;
      cleanup();

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
    },
  };
}
