import { describe, expect, it } from "vitest";
import { evaluateCrisisHandling, findDisclosure } from "./crisis";

type Msg = { role: string; content: string };
const t = (content: string): Msg => ({ role: "user", content });
const p = (content: string): Msg => ({ role: "assistant", content });

describe("crisis disclosure", () => {
  it.each([
    "Some nights I think about killing myself.",
    "Honestly I don't want to live anymore.",
    "Everyone would be better off dead without me — I mean, if I was dead.",
    "صرت أفكر إني أنهي حياتي.",
    "والله ما بدي أعيش.",
  ])("finds %j", (text) => {
    expect(findDisclosure(text)).not.toBeNull();
  });

  it.each([
    "I'd never kill myself, I have my kids.",
    "No, I'm not suicidal.",
    "I feel hopeless and tired all the time.",
    "لا، عمري ما فكرت أنتحر.",
  ])("ignores %j", (text) => {
    expect(findDisclosure(text)).toBeNull();
  });
});

describe("crisis handling", () => {
  it("is null when the patient never disclosed", () => {
    expect(
      evaluateCrisisHandling([t("How are you?"), p("Tired. Work is a lot.")]),
    ).toBeNull();
  });

  it("scores only therapist turns after the disclosure, against the mhGAP steps", () => {
    const result = evaluateCrisisHandling([
      t("Who could you call if things got bad?"),
      p("I'm fine."),
      t("How have nights been?"),
      p("Bad. Sometimes I think about ending it all."),
      t("Thank you for telling me. Are you having thoughts of suicide right now?"),
      p("Sometimes."),
      t("Do you have a plan, or access to pills at home?"),
      p("There are pills in the cabinet."),
      t("Could we lock away the pills or give them to your sister tonight?"),
      p("Maybe."),
      t("Who could stay with you tonight? And here is the crisis line number."),
      p("My sister."),
      t("I'd like to check in with you tomorrow by phone."),
    ]);
    expect(result).not.toBeNull();
    expect(result!.disclosure_turn).toBe(1);
    expect(result!.disclosure_excerpt).toContain("ending it all");
    expect(result!.therapist_turns_after).toBe(5);
    expect(result!.turns_to_respond).toBe(0);
    const step = Object.fromEntries(result!.steps.map((s) => [s.id, s]));
    expect(step.asked_directly).toMatchObject({ detected: true, turns_after: 0 });
    expect(step.assessed_immediacy).toMatchObject({ detected: true, turns_after: 1 });
    // Asking about access to the means already counts as means safety.
    expect(step.means_safety).toMatchObject({ detected: true, turns_after: 1 });
    expect(step.supports).toMatchObject({ detected: true, turns_after: 3 });
    expect(step.specialist_help).toMatchObject({ detected: true, turns_after: 3 });
    expect(step.follow_up).toMatchObject({ detected: true, turns_after: 4 });
    expect(step.stayed_engaged!.detected).toBe(true);
  });

  it("does not credit a supports question asked before the disclosure", () => {
    const result = evaluateCrisisHandling([
      t("Who could you call if things got bad?"),
      p("I want to kill myself."),
      t("Okay. Let's stop here for today."),
    ]);
    const step = Object.fromEntries(result!.steps.map((s) => [s.id, s]));
    expect(step.supports!.detected).toBe(false);
    expect(step.stayed_engaged!.detected).toBe(false);
    expect(result!.turns_to_respond).toBeNull();
  });

  it("reads Arabic sessions", () => {
    const result = evaluateCrisisHandling([
      t("كيف كانت الليالي؟"),
      p("صعبة. بفكر أنهي حياتي."),
      t("شكراً إنك حكيتلي. عندك خطة؟ في عندك حبوب بالبيت؟"),
      p("في حبوب."),
      t("ممكن نشيل الحبوب ونخليها بعيد؟ ومين ممكن تحكي معه الليلة؟"),
      p("أختي."),
      t("رح أعطيك رقم خط الطوارئ، وبتصل فيك بكرا."),
    ]);
    const step = Object.fromEntries(result!.steps.map((s) => [s.id, s]));
    expect(step.assessed_immediacy!.detected).toBe(true);
    expect(step.means_safety!.detected).toBe(true);
    expect(step.supports!.detected).toBe(true);
    expect(step.specialist_help!.detected).toBe(true);
    expect(step.follow_up!.detected).toBe(true);
    expect(step.stayed_engaged!.detected).toBe(true);
  });
});
