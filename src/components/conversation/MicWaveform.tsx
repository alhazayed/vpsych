"use client";

import type { WaveformSample } from "@/lib/conversation";

/**
 * Local-only microphone waveform. No audio is stored or transmitted from this view.
 */
export function MicWaveform({
  samples,
  visible,
}: {
  samples: WaveformSample[];
  visible: boolean;
}) {
  if (!visible) return null;
  const bars = samples.length
    ? samples
    : Array.from({ length: 24 }, () => ({
        energy: 0.02,
        clipping: false,
        isSpeech: false,
        isNoise: false,
      }));

  return (
    <div
      className="mt-4 flex h-10 w-full max-w-xs items-end justify-center gap-[3px]"
      aria-hidden
      data-testid="hfte-waveform"
    >
      {bars.slice(-32).map((s, i) => {
        const h = Math.max(3, Math.min(40, s.energy * 220));
        let color = "bg-[var(--outline-variant)]";
        if (s.clipping) color = "bg-[var(--error)]";
        else if (s.isSpeech) color = "bg-[var(--secondary)]";
        else if (s.isNoise) color = "bg-[var(--tertiary)]/60";
        return (
          <div
            key={i}
            className={`w-[3px] rounded-sm transition-[height,background-color] duration-75 ${color}`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}
