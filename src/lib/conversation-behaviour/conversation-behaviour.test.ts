/**
 * Conversation Behaviour Engine (Mission 7) — unit tests.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_BEHAVIOUR_KINDS,
  BEHAVIOUR_CATALOG,
  candidateWeights,
  classifySensitiveTopic,
  classifyTherapistMove,
  disclosureGateFromRapport,
  estimateRapport,
  formatConversationBehaviourBlock,
  isConversationBehaviourEnabled,
  mergeBehaviourIntoReinforcement,
  planConversationBehaviour,
} from "@/lib/conversation-behaviour";

describe("Conversation Behaviour Engine catalogue", () => {
  it("covers every Mission 7 behaviour kind", () => {
    const required = [
      "avoidance",
      "denial",
      "minimization",
      "guardedness",
      "lying",
      "embarrassment",
      "crying",
      "anger",
      "topic_switching",
      "silence",
      "therapist_interruption",
      "rapport_disclosure",
    ] as const;
    for (const kind of required) {
      expect(ALL_BEHAVIOUR_KINDS).toContain(kind);
      expect(BEHAVIOUR_CATALOG[kind].directives.length).toBeGreaterThan(0);
    }
    expect(ALL_BEHAVIOUR_KINDS).toHaveLength(12);
  });

  it("forbids inventing clinical records in lying directives", () => {
    const lying = BEHAVIOUR_CATALOG.lying.directives.join(" ");
    expect(lying).toMatch(/NOT invent hospitals|records/i);
  });
});

describe("therapist-move classification", () => {
  it("detects safety, confrontation, reflection, and advice", () => {
    expect(classifyTherapistMove("Have you had any suicidal thoughts?")).toBe(
      "safety_check",
    );
    expect(
      classifyTherapistMove("You're not being honest about the drinking."),
    ).toBe("confrontation");
    expect(
      classifyTherapistMove("It sounds like you've been carrying a lot."),
    ).toBe("reflection");
    expect(
      classifyTherapistMove("You should try to think positive and exercise."),
    ).toBe("advice");
  });

  it("marks barge-in as interruption", () => {
    expect(
      classifyTherapistMove("How are you?", { therapistInterrupted: true }),
    ).toBe("interruption");
  });

  it("classifies sensitive topics", () => {
    expect(classifySensitiveTopic("Tell me about the assault.")).toBe("trauma");
    expect(classifySensitiveTopic("How much do you drink each night?")).toBe(
      "substance",
    );
    expect(classifySensitiveTopic("Do you feel ashamed about that?")).toBe(
      "shame",
    );
    expect(classifySensitiveTopic("How was work this week?")).toBe("none");
  });
});

describe("rapport and disclosure gates", () => {
  it("starts guarded and warms with empathic turns", () => {
    const cold = estimateRapport({
      history: [],
      turnIndex: 0,
      difficulty: {
        alliance: "fragile",
        resistance: "high",
        disclosure: "guarded",
      },
    });
    const warm = estimateRapport({
      history: [
        { role: "user", content: "It sounds like that was really hard." },
        { role: "assistant", content: "Yeah…" },
        { role: "user", content: "That makes sense — anyone would feel that." },
      ],
      turnIndex: 6,
      difficulty: {
        alliance: "warm",
        resistance: "low",
        disclosure: "high",
      },
    });
    expect(cold).toBeLessThan(40);
    expect(warm).toBeGreaterThan(cold);
    expect(warm).toBeGreaterThan(55);
  });

  it("keeps sensitive probes from full open disclosure", () => {
    const gate = disclosureGateFromRapport({
      rapport: 80,
      sensitiveTopic: "trauma",
      therapistMove: "sensitive_probe",
      difficulty: { disclosure: "mixed", resistance: "moderate" },
    });
    expect(gate).not.toBe("open");
  });

  it("does not let early patients answer everything", () => {
    const gate = disclosureGateFromRapport({
      rapport: 25,
      sensitiveTopic: "none",
      therapistMove: "open_question",
      difficulty: { disclosure: "minimal", resistance: "very_high" },
    });
    expect(["withhold", "deflect"]).toContain(gate);
  });
});

describe("planConversationBehaviour", () => {
  const base = {
    sessionId: "sess-cbe-test",
    history: [] as { role: "user" | "assistant"; content: string }[],
    difficulty: {
      insight: "partial",
      resistance: "high",
      disclosure: "guarded",
      alliance: "fragile",
      masking: "moderate",
    },
    disorderSlug: "ptsd",
    language: "en",
  };

  it("is deterministic for the same seed inputs", () => {
    const a = planConversationBehaviour({
      ...base,
      turnIndex: 1,
      userMessage: "Tell me about the flashbacks.",
    });
    const b = planConversationBehaviour({
      ...base,
      turnIndex: 1,
      userMessage: "Tell me about the flashbacks.",
    });
    expect(a.primary).toBe(b.primary);
    expect(a.disclosureGate).toBe(b.disclosureGate);
    expect(a.promptBlock).toBe(b.promptBlock);
  });

  it("forces therapist_interruption handling on barge-in", () => {
    const plan = planConversationBehaviour({
      ...base,
      turnIndex: 3,
      userMessage: "Sorry — go on.",
      therapistInterrupted: true,
    });
    expect(plan.therapistMove).toBe("interruption");
    expect(
      plan.primary === "therapist_interruption" ||
        plan.secondary.includes("therapist_interruption") ||
        plan.directives.some((d) => /cut off|interrupted/i.test(d)),
    ).toBe(true);
    // Weighting should make interruption the primary almost always.
    expect(plan.primary).toBe("therapist_interruption");
  });

  it("biases substance probes toward denial / minimization / lying", () => {
    const weights = candidateWeights({
      gate: "deflect",
      move: "sensitive_probe",
      sensitive: "substance",
      disorderSlug: "alcohol-use-disorder",
    });
    const byKind = Object.fromEntries(weights.map((w) => [w.kind, w.weight]));
    expect(byKind.denial).toBeGreaterThan(byKind.crying);
    expect(byKind.minimization).toBeGreaterThan(2);
    expect(byKind.lying).toBeGreaterThan(2);
  });

  it("includes a disclosure gate and forbids instant full answers in the prompt", () => {
    const plan = planConversationBehaviour({
      ...base,
      turnIndex: 0,
      userMessage: "What brings you in today?",
    });
    expect(plan.promptBlock).toMatch(/DISCLOSURE GATE|disclosure gate/i);
    expect(plan.promptBlock).toMatch(/must NOT immediately answer everything/i);
    expect(plan.version).toBe("cbe-1");
    expect(plan.meta.kinds.length).toBeGreaterThan(0);
  });

  it("merges behaviour into existing reinforcement without dropping it", () => {
    const plan = planConversationBehaviour({
      ...base,
      turnIndex: 2,
      userMessage: "How have you been sleeping?",
    });
    const merged = mergeBehaviourIntoReinforcement("Stay in character.", plan);
    expect(merged).toContain("Stay in character.");
    expect(merged).toContain("CONVERSATION BEHAVIOUR THIS TURN");
  });

  it("format block lists primary behaviour", () => {
    const block = formatConversationBehaviourBlock({
      primary: "avoidance",
      secondary: ["rapport_disclosure"],
      directives: ["Do not answer the hard part yet."],
      disclosureGate: "deflect",
      rapport: 32,
    });
    expect(block).toContain("primary=avoidance");
    expect(block).toContain("Do not answer the hard part yet.");
  });

  it("can produce a direct silence utterance when withhold + silence", () => {
    // Probe multiple turn indices until silence short-circuit appears, or
    // assert silence directives exist when primary is silence.
    let sawSilenceDirective = false;
    let sawDirect = false;
    for (let i = 0; i < 40; i++) {
      const plan = planConversationBehaviour({
        ...base,
        sessionId: `sess-silence-${i}`,
        turnIndex: 0,
        userMessage: "Tell me everything about the trauma right now.",
        disorderSlug: "ptsd",
      });
      if (plan.primary === "silence") {
        sawSilenceDirective = true;
        if (plan.directReply) sawDirect = true;
      }
      if (plan.disclosureGate === "withhold" || plan.disclosureGate === "deflect") {
        expect(["withhold", "deflect"]).toContain(plan.disclosureGate);
      }
    }
    expect(sawSilenceDirective || sawDirect).toBe(true);
  });
});

describe("CBE feature flag", () => {
  afterEach(() => {
    delete process.env.CBE_ENABLED;
  });

  it("is enabled by default", () => {
    delete process.env.CBE_ENABLED;
    expect(isConversationBehaviourEnabled()).toBe(true);
  });

  it("can be disabled", () => {
    process.env.CBE_ENABLED = "false";
    expect(isConversationBehaviourEnabled()).toBe(false);
  });
});
