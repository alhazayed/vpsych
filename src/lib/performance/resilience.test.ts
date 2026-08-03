import { describe, expect, it, beforeEach } from "vitest";
import {
  BackpressureError,
  CircuitBreaker,
  CircuitOpenError,
  ConcurrencyLimiter,
  windowMessages,
} from "./resilience";

describe("CircuitBreaker", () => {
  it("opens after failure threshold and rejects while open", async () => {
    let now = 1_000;
    const cb = new CircuitBreaker("test", {
      failureThreshold: 2,
      openMs: 100,
      now: () => now,
    });

    await expect(
      cb.exec(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(
      cb.exec(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(cb.isOpen()).toBe(true);
    await expect(cb.exec(async () => "ok")).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    now += 150;
    expect(cb.getState()).toBe("half_open");
    await expect(cb.exec(async () => "ok")).resolves.toBe("ok");
    await expect(cb.exec(async () => "ok")).resolves.toBe("ok");
    expect(cb.getState()).toBe("closed");
  });
});

describe("ConcurrencyLimiter", () => {
  it("caps concurrency and reports queue depth", async () => {
    const limiter = new ConcurrencyLimiter(2, 4);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const running: Promise<string>[] = [];
    for (let i = 0; i < 2; i++) {
      running.push(
        limiter.run(async () => {
          await gate;
          return "done";
        }),
      );
    }

    await Promise.resolve();
    expect(limiter.activeCount).toBe(2);
    expect(limiter.queueDepth).toBe(0);

    const queued = limiter.run(async () => "queued");
    await Promise.resolve();
    expect(limiter.queueDepth).toBe(1);

    release();
    await expect(Promise.all([...running, queued])).resolves.toEqual([
      "done",
      "done",
      "queued",
    ]);
  });

  it("sheds load when the wait queue is full", async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const held = limiter.run(async () => {
      await gate;
      return "held";
    });
    await Promise.resolve();

    const waiting = limiter.run(async () => "wait");
    await Promise.resolve();
    expect(limiter.queueDepth).toBe(1);

    await expect(limiter.run(async () => "shed")).rejects.toBeInstanceOf(
      BackpressureError,
    );

    release();
    await expect(held).resolves.toBe("held");
    await expect(waiting).resolves.toBe("wait");
  });
});

describe("windowMessages", () => {
  it("keeps the trailing window", () => {
    expect(windowMessages([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    expect(windowMessages([1, 2], 5)).toEqual([1, 2]);
  });
});
