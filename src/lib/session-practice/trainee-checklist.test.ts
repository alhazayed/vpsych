import { describe, expect, it } from "vitest";
import { evaluateSessionPractice } from "./checklist";
import { buildTraineeChecklist } from "./trainee-checklist";

const t = (content: string) => ({ role: "user", content });
const p = (content: string) => ({ role: "assistant", content });

const transcript = [
  t("Hi, I'm your therapist today. What brings you in?"),
  p("I can't sleep."),
  t("Everything you say here stays confidential."),
  p("Okay."),
  t("Who do you have around you, family or friends?"),
  p("My sister."),
];

describe("trainee checklist", () => {
  it("lists only expected practices, as done or missed, with no scores", () => {
    const groups = buildTraineeChecklist(
      evaluateSessionPractice({ messages: transcript, sessionNumber: 1 }),
    );
    expect(groups.map((g) => g.group)).toEqual(["intake", "consent", "structure"]);
    for (const g of groups) {
      for (const item of g.items) {
        expect(Object.keys(item).sort()).toEqual(["done", "id"]);
      }
    }
    const items = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.id, i.done]));
    expect(items.role_intro).toBe(true);
    expect(items.confidentiality).toBe(true);
    expect(items.confidentiality_limits).toBe(false);
    // Measures are never expected; follow-up checks need a previous session.
    expect(items).not.toHaveProperty("phq9");
    expect(items).not.toHaveProperty("bridge");
  });

  it("adds safety planning only when the case carries risk", () => {
    const withRisk = buildTraineeChecklist(
      evaluateSessionPractice({ messages: transcript, sessionNumber: 2, riskPresent: true }),
    );
    expect(withRisk.map((g) => g.group)).toEqual(["structure", "safety_plan"]);
  });
});
