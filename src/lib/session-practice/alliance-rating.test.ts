import { describe, expect, it } from "vitest";
import {
  buildAllianceRating,
  findRuptures,
  sessionTraces,
} from "@/lib/session-practice/alliance-rating";
import type { AdaptationTurnTrace, TherapistBehaviourCue } from "@/lib/adaptation/types";

const START = "2026-10-06T08:00:00.000Z";
const END = "2026-10-06T08:30:00.000Z";

function trace(
  minute: number,
  rapport: number,
  trust: number,
  disclosure = 50,
  cues: TherapistBehaviourCue[] = [],
): AdaptationTurnTrace {
  return {
    at: new Date(Date.parse(START) + minute * 60_000).toISOString(),
    cues,
    rapport,
    trust,
    stance: "engaging",
    disclosure_readiness: disclosure,
  };
}

describe("sessionTraces", () => {
  it("keeps only turns inside the session window", () => {
    const state = {
      turn_traces: [trace(-10, 40, 40), trace(1, 50, 50), trace(29, 60, 60), trace(45, 70, 70)],
    };
    expect(sessionTraces(state, START, END).map((t) => t.rapport)).toEqual([50, 60]);
  });

  it("is empty without a state", () => {
    expect(sessionTraces(null, START, END)).toEqual([]);
  });
});

describe("findRuptures", () => {
  it("flags a judgmental trust drop and its repair", () => {
    const traces = [
      trace(1, 50, 60),
      trace(2, 45, 50, 40, ["judgment"]),
      trace(3, 50, 55, 45, ["repair"]),
      trace(4, 55, 61, 50, ["warmth"]),
    ];
    const [r] = findRuptures(traces);
    expect(r).toMatchObject({ turn_index: 1, trust_before: 60, trust_after: 50, repaired: true, repaired_turn_index: 3 });
  });

  it("ignores a small drift without a rupture cue", () => {
    expect(findRuptures([trace(1, 50, 60), trace(2, 50, 54)])).toEqual([]);
  });

  it("counts a large drop even without a cue, unrepaired", () => {
    const [r] = findRuptures([trace(1, 50, 60), trace(2, 40, 48)]);
    expect(r).toMatchObject({ repaired: false, repaired_turn_index: null });
  });
});

describe("buildAllianceRating", () => {
  it("returns null when the session left no patient trace", () => {
    expect(buildAllianceRating({ state: { turn_traces: [] }, startedAt: START, endedAt: END })).toBeNull();
  });

  it("maps end rapport, mean disclosure and end trust onto 0–10", () => {
    const rating = buildAllianceRating({
      state: { turn_traces: [trace(1, 40, 50, 40), trace(2, 70, 80, 60)] },
      startedAt: START,
      endedAt: END,
    })!;
    expect(rating).toMatchObject({ relationship: 7, goals_topics: 5, approach: 8, overall: 6.7, turns: 2 });
    expect(rating.total).toBeCloseTo(26.7, 1);
    expect(rating.limitations.length).toBeGreaterThan(0);
  });

  it("lowers overall for an unrepaired rupture", () => {
    const steady = buildAllianceRating({
      state: { turn_traces: [trace(1, 60, 70), trace(2, 60, 70)] },
      startedAt: START,
      endedAt: END,
    })!;
    const ruptured = buildAllianceRating({
      state: { turn_traces: [trace(1, 60, 78), trace(2, 60, 70, 50, ["curt"])] },
      startedAt: START,
      endedAt: END,
    })!;
    expect(ruptured.ruptures).toHaveLength(1);
    expect(ruptured.overall).toBe(steady.overall - 0.5);
  });
});
