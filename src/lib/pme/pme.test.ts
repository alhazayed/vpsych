import { describe, expect, it } from "vitest";
import {
  PME_VERSION,
  beginNextSession,
  createInitialMindState,
  processTherapistTurn,
  buildExpressionDirective,
  formatExpressionBlock,
} from "@/lib/pme";
import {
  computePatientMindFidelityIndex,
  PMFI_VERSION,
  assertPmfiWeightMatrixValid,
} from "@/lib/pmfi";

describe("Patient Mind Engine", () => {
  it("owns psychology: warm interviewing raises trust gradually", () => {
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "mdd-recurrent-moderate",
      disorderName: "Major Depressive Disorder",
      category: "mood",
      therapistId: "t1",
    });
    expect(mind.pme_version).toBe(PME_VERSION);
    const startTrust = mind.relationship.trust;

    for (let i = 0; i < 4; i++) {
      mind = processTherapistTurn(
        mind,
        "That sounds really hard. Thank you for sharing — I'm with you. Tell me more about the tiredness.",
        { turnIndex: i + 1 },
      ).mind;
    }
    expect(mind.relationship.trust).toBeGreaterThan(startTrust);
    // Gradual — not an instant flip to 90+
    expect(mind.relationship.trust - startTrust).toBeLessThan(30);
  });

  it("reduces trust and activates defenses under cold confrontation", () => {
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "mdd-recurrent-moderate",
      category: "mood",
    });
    const start = mind.relationship.trust;
    const result = processTherapistTurn(
      mind,
      "Just answer yes or no. Why didn't you take your meds? Stop minimizing.",
      { turnIndex: 1 },
    );
    mind = result.mind;
    expect(mind.relationship.trust).toBeLessThanOrEqual(start);
    expect(mind.current_defenses.length).toBeGreaterThan(0);
    expect(result.expressionBlock).toContain("MODULE PME");
    expect(result.expressionBlock).toContain("EXPRESS ONLY");
  });

  it("keeps disclosure continuous — unearned topics stay closed", () => {
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "ptsd",
      category: "trauma",
    });
    mind = processTherapistTurn(mind, "How was your week?", { turnIndex: 1 })
      .mind;
    const trauma = mind.disclosure.find((d) => d.topic === "trauma")!;
    expect(trauma.last_level === "closed" || trauma.last_level === "hinted").toBe(
      true,
    );
    expect(trauma.readiness).toBeLessThan(75);
  });

  it("advances session arc and carries life events longitudinally", () => {
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "gad-with-panic",
      category: "anxiety",
    });
    for (let i = 0; i < 6; i++) {
      mind = processTherapistTurn(
        mind,
        "I hear how anxious that feels. What was that like in your body?",
        { turnIndex: i + 1 },
      ).mind;
    }
    expect(mind.therapy.phase).not.toBe("opening");

    const next = beginNextSession(mind, { seed: "test-seed-1" });
    expect(next.therapy.session_index).toBe(2);
    expect(next.relationship.sessions_together).toBeGreaterThanOrEqual(2);
    expect(next.life_events.length).toBeGreaterThanOrEqual(1);

    const opened = processTherapistTurn(next, "How have things been since last time?", {
      turnIndex: 1,
    });
    expect(opened.expressionBlock).toMatch(/Life outside therapy|Between-session/i);
  });

  it("expression directive forbids inventing contradictory state", () => {
    const mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "bipolar-mania",
      category: "mood",
    });
    const d = buildExpressionDirective(mind, null);
    expect(d.hard_constraints.join(" ")).toMatch(/Never recite diagnostic/i);
    expect(formatExpressionBlock(d)).toContain("do NOT invent");
  });
});

describe("PMFI", () => {
  it("weights sum to 1 and scores wired PME highly", () => {
    expect(() => assertPmfiWeightMatrixValid()).not.toThrow();
    expect(PMFI_VERSION).toBe("1.0.0");

    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "mdd-recurrent-moderate",
      category: "mood",
    });
    mind = processTherapistTurn(
      mind,
      "That sounds hard. I'm glad you're here — can you say more?",
      { turnIndex: 1 },
    ).mind;

    const pmfi = computePatientMindFidelityIndex({
      mind,
      expressionLayerWired: true,
      persisted: true,
    });
    expect(pmfi.overall).toBeGreaterThanOrEqual(65);
    expect(pmfi.subscores).toHaveLength(10);
  });
});
