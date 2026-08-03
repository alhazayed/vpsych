/**
 * Per-instance concurrency gates (Fluid Compute / Node process).
 *
 * Caps simultaneous expensive upstream work (OpenAI chat, assessment, TTS)
 * so a stampede on one instance returns fast 503 + Retry-After instead of
 * unbounded queueing, memory growth, and cascading timeouts.
 *
 * Not a global cluster lock — pair with Upstash rate limits for horizontal safety.
 */

export class ConcurrencyBusyError extends Error {
  readonly retryAfterSec: number;
  readonly code = "CONCURRENCY_BUSY" as const;

  constructor(retryAfterSec = 1) {
    super("Server busy — retry shortly");
    this.name = "ConcurrencyBusyError";
    this.retryAfterSec = Math.max(1, retryAfterSec);
  }
}

type Waiter = {
  resolve: (ok: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ConcurrencyGate {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    readonly max: number,
    readonly queueTimeoutMs: number = 2_000,
  ) {
    if (max < 1) throw new Error("ConcurrencyGate max must be >= 1");
  }

  get inFlight() {
    return this.active;
  }

  get queued() {
    return this.waiters.length;
  }

  reset() {
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.resolve(false);
    }
    this.waiters.length = 0;
    this.active = 0;
  }

  async acquire(): Promise<
    { ok: true; release: () => void } | { ok: false; retryAfterSec: number }
  > {
    if (this.active < this.max) {
      this.active += 1;
      return { ok: true, release: () => this.release() };
    }

    const ok = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(false);
      }, this.queueTimeoutMs);
      this.waiters.push({ resolve, timer });
    });

    if (!ok) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil(this.queueTimeoutMs / 1000)),
      };
    }
    // Slot transferred from previous holder — active unchanged.
    return { ok: true, release: () => this.release() };
  }

  private release() {
    const next = this.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(true);
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const slot = await this.acquire();
    if (!slot.ok) {
      throw new ConcurrencyBusyError(slot.retryAfterSec);
    }
    try {
      return await fn();
    } finally {
      slot.release();
    }
  }
}

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Simultaneous patient-chat generations per instance. */
export const aiChatGate = new ConcurrencyGate(
  envInt("AI_CHAT_MAX_INFLIGHT", 8),
  envInt("AI_CHAT_QUEUE_MS", 2_000),
);

/** Simultaneous session assessments / report generations per instance. */
export const aiAssessGate = new ConcurrencyGate(
  envInt("AI_ASSESS_MAX_INFLIGHT", 4),
  envInt("AI_ASSESS_QUEUE_MS", 3_000),
);

/** Simultaneous ElevenLabs TTS syntheses per instance. */
export const ttsGate = new ConcurrencyGate(
  envInt("TTS_MAX_INFLIGHT", 10),
  envInt("TTS_QUEUE_MS", 2_000),
);

/** Simultaneous OpenAI STT transcriptions per instance. */
export const sttGate = new ConcurrencyGate(
  envInt("STT_MAX_INFLIGHT", 10),
  envInt("STT_QUEUE_MS", 2_000),
);

/** Test helper — drain all gates. */
export function resetConcurrencyGates() {
  aiChatGate.reset();
  aiAssessGate.reset();
  ttsGate.reset();
  sttGate.reset();
}
