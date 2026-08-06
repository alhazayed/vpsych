/**
 * Browser TTS / audio playback helpers for HFTE interruption.
 * Never stores audio — object URLs are revoked on stop.
 */

export type PlaybackHandle = {
  fadeOutAndStop: (fadeMs?: number) => Promise<void>;
  stopImmediate: () => void;
  isPlaying: () => boolean;
};

export async function playAudioWithInterrupt(params: {
  objectUrl: string;
  audioRef?: { current: HTMLAudioElement | null };
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
}): Promise<PlaybackHandle> {
  const audio = new Audio(params.objectUrl);
  if (params.audioRef) params.audioRef.current = audio;
  let playing = true;
  let settled = false;

  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    playing = false;
    try {
      URL.revokeObjectURL(params.objectUrl);
    } catch {
      /* ignore */
    }
    if (params.audioRef) params.audioRef.current = null;
    if (ok) params.onend?.();
    else params.onerror?.();
  };

  audio.onended = () => finish(true);
  audio.onerror = () => finish(false);
  params.onstart?.();
  void audio.play().catch(() => finish(false));

  return {
    isPlaying: () => playing && !settled,
    stopImmediate() {
      try {
        audio.pause();
        audio.src = "";
      } catch {
        /* ignore */
      }
      window.speechSynthesis?.cancel();
      finish(true);
    },
    async fadeOutAndStop(fadeMs = 180) {
      if (settled) return;
      const startVol = audio.volume;
      const steps = 8;
      const stepMs = Math.max(16, Math.floor(fadeMs / steps));
      for (let i = 1; i <= steps; i++) {
        if (settled) return;
        audio.volume = Math.max(0, startVol * (1 - i / steps));
        await new Promise((r) => setTimeout(r, stepMs));
      }
      try {
        audio.pause();
        audio.src = "";
      } catch {
        /* ignore */
      }
      window.speechSynthesis?.cancel();
      finish(true);
    },
  };
}

export function stopAllSpeech(
  audioRef?: { current: HTMLAudioElement | null },
): void {
  window.speechSynthesis?.cancel();
  if (audioRef?.current) {
    try {
      audioRef.current.pause();
      audioRef.current.src = "";
    } catch {
      /* ignore */
    }
    audioRef.current = null;
  }
}
