/**
 * Voice Activity Detection — auto end-of-utterance (Layer 7).
 * Single mic stream: RMS analysis + WAV capture.
 */

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

export type VadMicRecorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  wasAutoTriggered: () => boolean;
};

export type VadRecorderOptions = {
  silenceMs?: number;
  speechThreshold?: number;
  minSpeechMs?: number;
  maxMs?: number;
  onSpeechStart?: () => void;
  onUtteranceEnd?: () => void;
};

export async function createVadMicPipeline(
  options: VadRecorderOptions = {},
): Promise<VadMicRecorder> {
  const silenceMs = options.silenceMs ?? 1400;
  const threshold = options.speechThreshold ?? 0.018;
  const minSpeechMs = options.minSpeechMs ?? 400;
  const maxMs = options.maxMs ?? 15000;

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
  let stopped = false;
  let speechStarted = false;
  let speechStartTime = 0;
  let lastLoudTime = 0;
  let autoTriggered = false;

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));

    let sum = 0;
    for (let i = 0; i < input.length; i++) {
      sum += input[i]! * input[i]!;
    }
    const rms = Math.sqrt(sum / input.length);
    const now = Date.now();
    const loud = rms >= threshold;

    if (loud) {
      if (!speechStarted) {
        speechStarted = true;
        speechStartTime = now;
        options.onSpeechStart?.();
      }
      lastLoudTime = now;
    } else if (
      speechStarted &&
      lastLoudTime > 0 &&
      now - lastLoudTime >= silenceMs &&
      now - speechStartTime >= minSpeechMs &&
      !autoTriggered
    ) {
      autoTriggered = true;
      options.onUtteranceEnd?.();
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  const timer = window.setTimeout(() => {
    if (!autoTriggered) options.onUtteranceEnd?.();
  }, maxMs);

  function cleanup() {
    window.clearTimeout(timer);
    stopped = true;
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void audioContext.close();
  }

  return {
    cancel() {
      cleanup();
    },
    async stop() {
      cleanup();
      let length = 0;
      for (const c of chunks) length += c.length;
      const merged = new Float32Array(length);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      const down = downsample(merged, audioContext.sampleRate, 16000);
      return encodeWav(down, 16000);
    },
    wasAutoTriggered() {
      return autoTriggered;
    },
  };
}
