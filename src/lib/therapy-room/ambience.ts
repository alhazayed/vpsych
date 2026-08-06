import type { RoomAmbienceKind } from "./types";

/**
 * Optional subtle room ambience.
 * Uses Web Audio oscillators / noise — no music, no stored recordings.
 * Volume should stay near-subliminal so it never competes with speech.
 */

export type AmbienceController = {
  setKind: (kind: RoomAmbienceKind) => void;
  setVolume: (v: number) => void;
  stop: () => void;
};

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }
  return buffer;
}

export function startRoomAmbience(params: {
  kind: RoomAmbienceKind;
  volume?: number;
}): AmbienceController | null {
  if (typeof window === "undefined") return null;
  if (params.kind === "silence") {
    return {
      setKind() {},
      setVolume() {},
      stop() {},
    };
  }

  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  let volume = Math.max(0, Math.min(0.08, params.volume ?? 0.025));
  master.gain.value = volume;
  master.connect(ctx.destination);

  let nodes: AudioNode[] = [];

  const clear = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    nodes = [];
  };

  const build = (kind: RoomAmbienceKind) => {
    clear();
    if (kind === "silence") {
      master.gain.value = 0;
      return;
    }
    master.gain.value = volume;

    if (kind === "hvac") {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 280;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      noise.start();
      nodes = [noise, filter, gain];
      return;
    }

    if (kind === "clock") {
      const tick = () => {
        if (ctx.state === "closed") return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = 880;
        g.gain.value = 0.04;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      };
      tick();
      const id = window.setInterval(tick, 1000);
      nodes = [
        {
          disconnect() {
            window.clearInterval(id);
          },
        } as unknown as AudioNode,
      ];
      return;
    }

    // chair / paper — very occasional soft noise burst
    const burst = () => {
      if (ctx.state === "closed") return;
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = kind === "paper" ? 2400 : 400;
      const g = ctx.createGain();
      g.gain.value = 0.08;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      noise.connect(filter);
      filter.connect(g);
      g.connect(master);
      noise.start();
      noise.stop(ctx.currentTime + 0.35);
    };
    burst();
    const id = window.setInterval(burst, kind === "paper" ? 28000 : 45000);
    nodes = [
      {
        disconnect() {
          window.clearInterval(id);
        },
      } as unknown as AudioNode,
    ];
  };

  build(params.kind);

  return {
    setKind(kind) {
      build(kind);
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(0.08, v));
      master.gain.value = volume;
    },
    stop() {
      clear();
      void ctx.close();
    },
  };
}
