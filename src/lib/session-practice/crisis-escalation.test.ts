import { describe, expect, it } from "vitest";
import {
  CRISIS_ESCALATION_MARKER,
  ESCALATION_REPLY,
  crisisEscalationPhase,
  formatCrisisEscalationBlock,
  injectCrisisEscalationIntoSystemPrompt,
} from "./crisis-escalation";

const withPlan = { suicidal_ideation: "active_with_plan" as const };
const noPlan = { suicidal_ideation: "active_no_plan" as const };
const quiet = ["I'm okay.", "Work is busy.", "I sleep badly."];

describe("crisis escalation phase", () => {
  it.each([
    [{ suicidal_ideation: "none" as const }],
    [{ suicidal_ideation: "passive" as const }],
    [null],
    [undefined],
  ])("never escalates a case without active ideation (%j)", (risk) => {
    for (let n = 1; n <= 12; n++) {
      expect(
        crisisEscalationPhase({ risk, replyNumber: n, previousReplies: quiet }),
      ).toBe("none");
    }
  });

  it("escalates exactly once, on the fixed reply, then stays after", () => {
    const phases = Array.from({ length: 10 }, (_, i) =>
      crisisEscalationPhase({ risk: withPlan, replyNumber: i + 1, previousReplies: quiet }),
    );
    expect(phases.filter((p) => p === "escalate_now")).toHaveLength(1);
    expect(phases[ESCALATION_REPLY - 1]).toBe("escalate_now");
    expect(phases.slice(0, ESCALATION_REPLY - 1).every((p) => p === "none")).toBe(true);
    expect(phases.slice(ESCALATION_REPLY).every((p) => p === "after_disclosure")).toBe(true);
  });

  it("does not repeat the escalation when the patient already disclosed", () => {
    expect(
      crisisEscalationPhase({
        risk: noPlan,
        replyNumber: 3,
        previousReplies: ["Sometimes I think about killing myself."],
      }),
    ).toBe("after_disclosure");
    expect(
      crisisEscalationPhase({
        risk: noPlan,
        replyNumber: ESCALATION_REPLY,
        previousReplies: ["Sometimes I think about killing myself."],
      }),
    ).toBe("after_disclosure");
  });
});

describe("crisis escalation block", () => {
  it("never gives a case without a plan a plan", () => {
    const block = formatCrisisEscalationBlock("escalate_now", noPlan);
    expect(block).toContain("you have no plan");
    expect(block).not.toMatch(/you have a plan/);
  });

  it("forbids method detail and test framing", () => {
    const block = formatCrisisEscalationBlock("escalate_now", withPlan);
    expect(block).toContain("you have a plan");
    expect(block).toMatch(/Never describe a method/);
    expect(block).toMatch(/Never say this is a test/);
  });

  it("after the disclosure, the patient reacts and neither retracts nor escalates", () => {
    const block = formatCrisisEscalationBlock("after_disclosure", withPlan);
    expect(block).toMatch(/Do not take it back and do not escalate further/);
  });

  it("leaves prompts byte-identical when it does not apply, and injects once", () => {
    const base = "You are Maya, a patient.";
    expect(
      injectCrisisEscalationIntoSystemPrompt(base, {
        risk: { suicidal_ideation: "passive" },
        replyNumber: ESCALATION_REPLY,
        previousReplies: quiet,
      }),
    ).toBe(base);
    expect(
      injectCrisisEscalationIntoSystemPrompt(base, {
        risk: withPlan,
        replyNumber: 2,
        previousReplies: quiet,
      }),
    ).toBe(base);
    const once = injectCrisisEscalationIntoSystemPrompt(base, {
      risk: withPlan,
      replyNumber: ESCALATION_REPLY,
      previousReplies: quiet,
    });
    expect(once).toContain(CRISIS_ESCALATION_MARKER);
    expect(
      injectCrisisEscalationIntoSystemPrompt(once, {
        risk: withPlan,
        replyNumber: ESCALATION_REPLY,
        previousReplies: quiet,
      }),
    ).toBe(once);
  });
});
