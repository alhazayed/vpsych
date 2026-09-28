import { describe, expect, it } from "vitest";
import { createTherapistInterruptedFlag } from "@/lib/voice/interrupt-flag";

describe("createTherapistInterruptedFlag (Phase 9.1R)", () => {
  it("Test C — interruption + empty STT keeps flag for later valid turn", () => {
    const flag = createTherapistInterruptedFlag();
    flag.mark(); // patient cut off; mic opened
    // empty / no-speech — do not consume
    expect(flag.isPending()).toBe(true);
    // next valid therapist turn
    expect(flag.consumeForSubmit()).toBe(true);
    expect(flag.isPending()).toBe(false);
  });

  it("Test D — interruption + valid turn consumes exactly once", () => {
    const flag = createTherapistInterruptedFlag();
    flag.mark();
    expect(flag.consumeForSubmit()).toBe(true);
    expect(flag.consumeForSubmit()).toBe(false);
  });

  it("Test E — rapid successive interruptions stay latched until one submit", () => {
    const flag = createTherapistInterruptedFlag();
    flag.mark();
    flag.mark();
    flag.mark();
    expect(flag.isPending()).toBe(true);
    expect(flag.consumeForSubmit()).toBe(true);
    expect(flag.isPending()).toBe(false);
  });

  it("clear drops a pending latch (session end)", () => {
    const flag = createTherapistInterruptedFlag();
    flag.mark();
    flag.clear();
    expect(flag.consumeForSubmit()).toBe(false);
  });
});
