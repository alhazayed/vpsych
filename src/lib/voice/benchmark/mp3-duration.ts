/**
 * Minimal MPEG-1/2/2.5 Layer III frame parser — audio duration only.
 *
 * Needed because a benchmark that compares two providers must know how long
 * each rendered clip actually is; "which voice is slower" is a pace-control
 * question, not a latency question, and conflating them would invalidate the
 * comparison.
 *
 * Deliberately dependency-free and read-only: it never decodes or rewrites
 * audio, and it is used only by the benchmark harness.
 */

/** Bitrate table (kbps) for MPEG Layer III, indexed by version group. */
const BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1,
] as const;
const BITRATES_V2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1,
] as const;

/** Sample rates (Hz) by MPEG version. */
const SAMPLE_RATES: Record<number, readonly number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

/** Samples per frame for Layer III by MPEG version. */
function samplesPerFrame(versionBits: number): number {
  return versionBits === 3 ? 1152 : 576;
}

export type Mp3DurationResult = {
  /** Total duration in milliseconds, or null when no frames were found. */
  durationMs: number | null;
  frameCount: number;
  /** Sample rate of the first frame, when parsed. */
  sampleRateHz: number | null;
};

/** Skip an ID3v2 tag if present, returning the offset of the audio data. */
function skipId3(bytes: Uint8Array): number {
  if (
    bytes.length >= 10 &&
    bytes[0] === 0x49 && // 'I'
    bytes[1] === 0x44 && // 'D'
    bytes[2] === 0x33 // '3'
  ) {
    // Synchsafe 28-bit size across bytes 6..9.
    const size =
      ((bytes[6]! & 0x7f) << 21) |
      ((bytes[7]! & 0x7f) << 14) |
      ((bytes[8]! & 0x7f) << 7) |
      (bytes[9]! & 0x7f);
    return 10 + size;
  }
  return 0;
}

/**
 * Estimate MP3 duration by walking frame headers.
 * Handles constant and variable bitrate, since each frame is measured
 * individually rather than extrapolated from the first one.
 */
export function estimateMp3Duration(
  buffer: ArrayBuffer | Uint8Array,
): Mp3DurationResult {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let offset = skipId3(bytes);
  let frameCount = 0;
  let totalMs = 0;
  let firstSampleRate: number | null = null;

  while (offset + 4 <= bytes.length) {
    const b0 = bytes[offset]!;
    const b1 = bytes[offset + 1]!;

    // Frame sync: 11 set bits.
    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }

    const versionBits = (b1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits = (b1 >> 1) & 0x03; // 1 = Layer III
    if (versionBits === 1 || layerBits !== 1) {
      offset += 1;
      continue;
    }

    const b2 = bytes[offset + 2]!;
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;

    if (bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 3) {
      offset += 1;
      continue;
    }

    const bitrateKbps =
      versionBits === 3
        ? BITRATES_V1_L3[bitrateIndex]!
        : BITRATES_V2_L3[bitrateIndex]!;
    const sampleRate = SAMPLE_RATES[versionBits]![sampleRateIndex]!;
    if (!bitrateKbps || bitrateKbps < 0 || !sampleRate) {
      offset += 1;
      continue;
    }

    const spf = samplesPerFrame(versionBits);
    const frameLength =
      Math.floor((spf / 8) * ((bitrateKbps * 1000) / sampleRate)) + padding;
    if (frameLength <= 4) {
      offset += 1;
      continue;
    }

    if (firstSampleRate === null) firstSampleRate = sampleRate;
    totalMs += (spf / sampleRate) * 1000;
    frameCount += 1;
    offset += frameLength;
  }

  return {
    durationMs: frameCount > 0 ? Math.round(totalMs) : null,
    frameCount,
    sampleRateHz: firstSampleRate,
  };
}
