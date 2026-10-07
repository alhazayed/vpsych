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

describe("trainee checklist, Arabic spelling variants", () => {
  it("detects everyday Levantine and MSA phrasing without hamza or taa marbuta", () => {
    const groups = buildTraineeChecklist(
      evaluateSessionPractice({
        sessionNumber: 2,
        riskPresent: true,
        messages: [
          t("مرحبا، كيفك اليوم؟ كيف كان اسبوعك؟"),
          p("تعبان شوي."),
          t("المره الماضيه حكينا عن النوم. عملت التمرين اللي اتفقنا عليه؟"),
          p("جربت شوي."),
          t("شو حابب نحكي فيه اليوم؟"),
          p("بدي احكي عن الشغل."),
          t("لما الافكار تصير صعبه، شو اللي بتلاحظه قبل ما تسوء الامور؟ هاي علامات التحذير."),
          p("بصير ما انام."),
          t("شو بتقدر تعمل لحالك عشان تهدا؟ ومين ممكن تتصل فيه؟"),
          p("اختي."),
          t("هذا رقم خط المساعده، وممكن نخلي الادويه بعيد عنك."),
          p("ماشي."),
          t("خلال الاسبوع الجاي بدي تجرب تكتب افكارك."),
          p("تمام."),
          t("باختصار اليوم حكينا عن النوم والشغل. كيف كانت الجلسه بالنسبه الك؟"),
        ],
      }),
    );
    const items = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.id, i.done]));
    expect(items).toEqual({
      mood_check: true,
      bridge: true,
      agenda: true,
      homework_review: true,
      homework_set: true,
      summary: true,
      feedback_elicited: true,
      warning_signs: true,
      internal_coping: true,
      social_supports: true,
      professional_contacts: true,
      means_safety: true,
    });
  });

  it("still marks practices that were not performed as missed", () => {
    const groups = buildTraineeChecklist(
      evaluateSessionPractice({
        sessionNumber: 2,
        messages: [t("أهلا."), p("أهلين."), t("احكيلي عن شغلك."), p("الشغل صعب.")],
      }),
    );
    expect(groups.flatMap((g) => g.items).every((i) => !i.done)).toBe(true);
  });
});

describe("trainee checklist, self-introduction", () => {
  it.each([
    "Hello, hi, this is Dr. Zareb speaking.",
    "This is Doctor Zaid speaking.",
    "Hi, it's Dr. Haddad.",
    "I'm Sara, your therapist for today.",
  ])("counts %j as introducing self and role", (line) => {
    const groups = buildTraineeChecklist(
      evaluateSessionPractice({ messages: [t(line), p("Hi.")], sessionNumber: 1 }),
    );
    const intro = groups.flatMap((g) => g.items).find((i) => i.id === "role_intro");
    expect(intro?.done).toBe(true);
  });
});

describe("trainee checklist, Arabic intake", () => {
  it("counts asking about work and marriage as social context", () => {
    const groups = buildTraineeChecklist(
      evaluateSessionPractice({
        sessionNumber: 1,
        messages: [
          t("مرحبا يعطيكم العافية أنا اسمي دكتور علاء زايد أنا اختصاصي طب النفسي."),
          p("أهلين دكتور."),
          t("طيب مش مشكلة بسيطة عندي أديها عمرك شو بتشتغلي متزوجة أو لا؟"),
        ],
      }),
    );
    const items = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.id, i.done]));
    expect(items.role_intro).toBe(true);
    expect(items.social_context).toBe(true);
  });
});
