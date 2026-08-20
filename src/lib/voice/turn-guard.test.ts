import { describe, expect, it } from "vitest";
import { createTurnGuard } from "@/lib/voice/turn-guard";

/**
 * Reproduces the human-QA failures and pins the fixed behaviour.
 * Test numbering follows the QA brief's required cases.
 */

describe("TEST 1 — one complete therapist turn → exactly one patient response", () => {
  it("accepts a single turn and completes it once", () => {
    const g = createTurnGuard();
    g.beginListening();

    const turn = g.beginTurn("How have you been this week?");
    expect(turn.accepted).toBe(true);
    if (!turn.accepted) return;

    expect(g.isCurrent(turn.turnId)).toBe(true);
    expect(g.completeTurn(turn.turnId)).toBe(true);
    // Completing twice must not yield a second response.
    expect(g.completeTurn(turn.turnId)).toBe(false);
  });
});

describe("TEST 2 — short pause must not create a premature second turn", () => {
  it("rejects a fragment-then-extension as the same utterance", () => {
    const g = createTurnGuard();
    g.beginListening();

    // Fragment finalised when the therapist paused mid-sentence.
    const first = g.beginTurn("أنا من فترة صرت أحس بقلق شديد");
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;
    expect(g.completeTurn(first.turnId)).toBe(true);

    // Therapist resumed; engine re-emits the whole utterance.
    const second = g.beginTurn(
      "أنا من فترة صرت أحس بقلق شديد، خصوصاً لما أكون بين الناس.",
    );
    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason).toBe("duplicate_transcript");
  });
});

describe("TEST 3 — two transcript-final events for one turn → one response", () => {
  it("rejects the second final that arrives before the first completes", () => {
    const g = createTurnGuard();
    g.beginListening();

    const a = g.beginTurn("I keep waking up at four in the morning.");
    const b = g.beginTurn("I keep waking up at four in the morning.");

    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(false);
    if (b.accepted) return;
    // This is the stale-closure race the React `pending` flag could not stop.
    expect(b.reason).toBe("turn_in_flight");
  });

  it("rejects an identical repeat even after the first completes", () => {
    const g = createTurnGuard();
    g.beginListening();
    const a = g.beginTurn("Tell me more.");
    if (!a.accepted) throw new Error("expected accept");
    g.completeTurn(a.turnId);

    const b = g.beginTurn("Tell me more.");
    expect(b.accepted).toBe(false);
  });
});

describe("TEST 4/5 — barge-in cancels, then exactly one new response", () => {
  it("cancelActive frees the guard and the next turn is accepted once", () => {
    const g = createTurnGuard();
    g.beginListening();

    const interrupted = g.beginTurn("Before the interruption.");
    expect(interrupted.accepted).toBe(true);
    if (!interrupted.accepted) return;

    // Therapist barges in: the in-flight turn is abandoned.
    g.cancelActive();
    expect(g.isCurrent(interrupted.turnId)).toBe(false);
    expect(g.activeTurnId()).toBeNull();

    // New listening window, new utterance.
    g.beginListening();
    const next = g.beginTurn("After the interruption.");
    expect(next.accepted).toBe(true);
    if (!next.accepted) return;
    expect(next.turnId).not.toBe(interrupted.turnId);
    expect(g.completeTurn(next.turnId)).toBe(true);
  });
});

describe("TEST 6 — rapid consecutive interactions produce no duplicates", () => {
  it("admits exactly one turn per completed cycle under a burst", () => {
    const g = createTurnGuard();
    const accepted: number[] = [];

    for (let i = 0; i < 20; i++) {
      g.beginListening();
      // Each utterance fires three finals in a burst.
      for (let dup = 0; dup < 3; dup++) {
        const r = g.beginTurn(`utterance number ${i}`);
        if (r.accepted) accepted.push(r.turnId);
      }
      const current = g.activeTurnId();
      if (current !== null) g.completeTurn(current);
    }

    expect(accepted).toHaveLength(20);
    expect(new Set(accepted).size).toBe(20);
  });
});

describe("TEST 7 — a stale response cannot land after a newer turn begins", () => {
  it("refuses to complete a superseded turn", () => {
    const g = createTurnGuard();
    g.beginListening();

    const stale = g.beginTurn("First question.");
    if (!stale.accepted) throw new Error("expected accept");

    // Barge-in, then a newer turn starts while the old request is in flight.
    g.cancelActive();
    g.beginListening();
    const fresh = g.beginTurn("Second question.");
    if (!fresh.accepted) throw new Error("expected accept");

    // The old request finally resolves — it must be discarded.
    expect(g.completeTurn(stale.turnId)).toBe(false);
    expect(g.isCurrent(stale.turnId)).toBe(false);
    // The newer turn is unaffected.
    expect(g.completeTurn(fresh.turnId)).toBe(true);
  });
});

describe("TEST 8 — Arabic turns get identical guarantees", () => {
  it("applies the same invariant to Arabic text without altering it", () => {
    const g = createTurnGuard();
    g.beginListening();

    const arabic = "بحس إني متوتر طول الوقت، وحتى لما أكون بالبيت مش قادر أرتاح.";
    const first = g.beginTurn(arabic);
    const second = g.beginTurn(arabic);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    if (!first.accepted) return;
    expect(g.completeTurn(first.turnId)).toBe(true);
  });

  it("treats whitespace-only differences as the same utterance", () => {
    const g = createTurnGuard();
    g.beginListening();
    const a = g.beginTurn("يعني   مش عارف");
    const b = g.beginTurn("يعني مش عارف");
    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(false);
  });

  it("allows a genuinely different Arabic utterance in a new window", () => {
    const g = createTurnGuard();
    g.beginListening();
    const a = g.beginTurn("شو صار معك هالأسبوع؟");
    if (!a.accepted) throw new Error("expected accept");
    g.completeTurn(a.turnId);

    g.beginListening();
    const b = g.beginTurn("ليش ما حكيتلي إنك مش منيح؟");
    expect(b.accepted).toBe(true);
  });
});

describe("guard hygiene", () => {
  it("rejects empty and whitespace-only transcripts", () => {
    const g = createTurnGuard();
    g.beginListening();
    expect(g.beginTurn("")).toMatchObject({ reason: "empty_transcript" });
    expect(g.beginTurn("   \n ")).toMatchObject({ reason: "empty_transcript" });
  });

  it("reset clears both the active turn and duplicate history", () => {
    const g = createTurnGuard();
    g.beginListening();
    const a = g.beginTurn("hello");
    expect(a.accepted).toBe(true);

    g.reset();
    expect(g.activeTurnId()).toBeNull();
    expect(g.beginTurn("hello").accepted).toBe(true);
  });

  it("issues strictly increasing turn ids", () => {
    const g = createTurnGuard();
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      g.beginListening();
      const r = g.beginTurn(`line ${i}`);
      if (r.accepted) {
        ids.push(r.turnId);
        g.completeTurn(r.turnId);
      }
    }
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
