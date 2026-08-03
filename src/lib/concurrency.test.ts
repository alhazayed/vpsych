import { afterEach, describe, expect, it } from "vitest";
import {
  ConcurrencyBusyError,
  ConcurrencyGate,
  resetConcurrencyGates,
} from "./concurrency";

afterEach(() => {
  resetConcurrencyGates();
});

describe("ConcurrencyGate", () => {
  it("allows up to max concurrent runners", async () => {
    const gate = new ConcurrencyGate(2, 50);
    let concurrent = 0;
    let peak = 0;

    const job = () =>
      gate.run(async () => {
        concurrent += 1;
        peak = Math.max(peak, concurrent);
        await new Promise((r) => setTimeout(r, 30));
        concurrent -= 1;
        return "ok";
      });

    const results = await Promise.all([job(), job(), job()]);
    expect(results).toEqual(["ok", "ok", "ok"]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("throws ConcurrencyBusyError when queue times out", async () => {
    const gate = new ConcurrencyGate(1, 20);
    const hold = gate.run(() => new Promise((r) => setTimeout(r, 80)));

    await expect(
      gate.run(async () => "never"),
    ).rejects.toBeInstanceOf(ConcurrencyBusyError);

    await hold;
  });

  it("recovers capacity after release", async () => {
    const gate = new ConcurrencyGate(1, 200);
    await gate.run(async () => "a");
    await expect(gate.run(async () => "b")).resolves.toBe("b");
    expect(gate.inFlight).toBe(0);
  });
});
