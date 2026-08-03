/**
 * Performance primitives — circuit breaker, concurrency backpressure, budgets.
 */

export type CircuitState = "closed" | "open" | "half_open";

export type CircuitBreakerOptions = {
  /** Failures before opening. Default 5. */
  failureThreshold?: number;
  /** Successes in half-open to close. Default 2. */
  successThreshold?: number;
  /** Ms to stay open before half-open probe. Default 30_000. */
  openMs?: number;
  now?: () => number;
};

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: CircuitState = "closed";
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor(
    readonly name: string,
    opts: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.successThreshold = opts.successThreshold ?? 2;
    this.openMs = opts.openMs ?? 30_000;
    this.now = opts.now ?? Date.now;
  }

  getState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  /** True when calls should be rejected immediately (backpressure). */
  isOpen(): boolean {
    return this.getState() === "open";
  }

  recordSuccess(): void {
    if (this.state === "half_open") {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state = "closed";
        this.failures = 0;
        this.successes = 0;
      }
      return;
    }
    this.failures = 0;
  }

  recordFailure(): void {
    this.successes = 0;
    this.failures += 1;
    if (
      this.state === "half_open" ||
      this.failures >= this.failureThreshold
    ) {
      this.state = "open";
      this.openedAt = this.now();
    }
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(this.name);
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (e) {
      this.recordFailure();
      throw e;
    }
  }

  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = "closed";
    this.openedAt = 0;
  }

  private maybeHalfOpen(): void {
    if (this.state === "open" && this.now() - this.openedAt >= this.openMs) {
      this.state = "half_open";
      this.successes = 0;
    }
  }
}

export class CircuitOpenError extends Error {
  readonly code = "CIRCUIT_OPEN" as const;
  constructor(name: string) {
    super(`Circuit open: ${name}`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Simple semaphore for concurrency backpressure (per isolate).
 * Rejects immediately when the wait queue exceeds `maxQueue` (shed load).
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  readonly maxQueue: number;

  constructor(readonly max: number, maxQueue?: number) {
    if (max < 1) throw new Error("max must be >= 1");
    this.maxQueue = maxQueue ?? max * 2;
  }

  get activeCount(): number {
    return this.active;
  }

  get queueDepth(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) {
      return Promise.reject(new BackpressureError(this.max, this.maxQueue));
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }
}

export class BackpressureError extends Error {
  readonly code = "BACKPRESSURE" as const;
  constructor(max: number, maxQueue: number) {
    super(`Backpressure: concurrency ${max} saturated (queue ≥ ${maxQueue})`);
    this.name = "BackpressureError";
  }
}

/** Shared breakers for upstream vendors (per isolate). */
export const openaiCircuit = new CircuitBreaker("openai", {
  failureThreshold: 5,
  openMs: 20_000,
});

export const elevenLabsCircuit = new CircuitBreaker("elevenlabs", {
  failureThreshold: 4,
  openMs: 25_000,
});

/** Cap concurrent upstream calls per isolate to shed overload. */
export const openaiLimiter = new ConcurrencyLimiter(
  Number(process.env.OPENAI_MAX_CONCURRENCY ?? 8),
);
export const elevenLabsLimiter = new ConcurrencyLimiter(
  Number(process.env.ELEVENLABS_MAX_CONCURRENCY ?? 6),
);

/** Sliding transcript window for patient replies (turns). */
export const MESSAGE_HISTORY_WINDOW = Number(
  process.env.MESSAGE_HISTORY_WINDOW ?? 24,
);

export function windowMessages<T>(messages: T[], window = MESSAGE_HISTORY_WINDOW): T[] {
  if (window <= 0 || messages.length <= window) return messages;
  return messages.slice(-window);
}
