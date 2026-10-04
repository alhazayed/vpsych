import { describe, expect, it } from "vitest";
import {
  CTSR_ITEM_ORDER,
  buildIndicativeCtsr,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateSessionPractice,
  formatSelfReportForPrompt,
  severityBand,
  windowRange,
} from "@/lib/session-practice";
import type { ClinicalCore, ScoreEntry } from "@/lib/types";

type Msg = { role: string; content: string };

function convo(therapist: string[]): Msg[] {
  return therapist.flatMap((t) => [
    { role: "user", content: t },
    { role: "assistant", content: "..." },
  ]);
}

function check(report: ReturnType<typeof evaluateSessionPractice>, id: string) {
  const c = report.checks.find((x) => x.id === id);
  if (!c) throw new Error(`missing check ${id}`);
  return c;
}

const EN_FIRST_SESSION = convo([
  "Hi, my name is Sara and I'm your therapist today.",
  "Before we start, what we talk about is confidential, except if there is a risk to your safety or someone else's. Is that okay?",
  "How have you been feeling this week?",
  "What would you like to focus on today?",
  "What brings you here?",
  "When did this first start?",
  "Who do you live with at the moment?",
  "What are you hoping to get from coming here?",
  "That sounds really hard.",
  "Tell me more about that.",
  "So today we talked about your sleep and your work stress.",
  "Between now and next week, could you try writing down your worries each evening?",
  "How did today's session feel for you?",
]);

const AR_FIRST_SESSION = convo([
  "مرحبا، اسمي ليلى وأنا المعالجة تبعتك.",
  "كل اشي بنحكيه هون سري، إلا إذا كان في خطر على حياتك.",
  "كيف كان أسبوعك؟",
  "شو حابب نحكي اليوم؟",
  "شو اللي جابك اليوم؟",
  "من قديش بلشت هالمشكلة؟",
  "مين ساكن معك؟",
  "شو بتتمنى يتغير؟",
  "فاهمة عليك.",
  "احكيلي أكثر.",
  "خلينا نلخص شو حكينا اليوم.",
  "خلال الأسبوع جرب تكتب أفكارك كل يوم.",
  "كيف كانت الجلسة بالنسبة إلك؟",
]);

describe("evaluateSessionPractice", () => {
  it("detects intake, consent and structure in an English first session", () => {
    const r = evaluateSessionPractice({ messages: EN_FIRST_SESSION });
    for (const id of [
      "role_intro",
      "presenting_problem",
      "history",
      "social_context",
      "expectations",
      "confidentiality",
      "confidentiality_limits",
      "consent_to_proceed",
      "mood_check",
      "agenda",
      "summary",
      "homework_set",
      "feedback_elicited",
    ]) {
      expect(check(r, id).detected, id).toBe(true);
    }
    const structure = r.groups.find((g) => g.group === "structure")!;
    expect(structure.met).toBe(structure.total);
  });

  it("detects the same practices in an Arabic first session", () => {
    const r = evaluateSessionPractice({ messages: AR_FIRST_SESSION });
    for (const id of [
      "role_intro",
      "presenting_problem",
      "history",
      "social_context",
      "expectations",
      "confidentiality",
      "confidentiality_limits",
      "mood_check",
      "agenda",
      "summary",
      "homework_set",
      "feedback_elicited",
    ]) {
      expect(check(r, id).detected, id).toBe(true);
    }
  });

  it("reads only therapist turns", () => {
    const r = evaluateSessionPractice({
      messages: [
        { role: "assistant", content: "My name is Omar and this is confidential." },
        { role: "user", content: "Okay." },
      ],
    });
    expect(check(r, "role_intro").detected).toBe(false);
    expect(check(r, "confidentiality").detected).toBe(false);
  });

  it("does not credit an agenda set only at the end of a long session", () => {
    const turns = Array.from({ length: 20 }, () => "Mm, go on.");
    turns[18] = "What would you like to focus on today?";
    const r = evaluateSessionPractice({ messages: convo(turns) });
    expect(check(r, "agenda").detected).toBe(false);
  });

  it("expects bridge and homework review only after session 1", () => {
    const first = evaluateSessionPractice({ messages: EN_FIRST_SESSION, sessionNumber: 1 });
    expect(check(first, "bridge").applicable).toBe(false);
    expect(check(first, "role_intro").applicable).toBe(true);

    const later = evaluateSessionPractice({
      messages: convo([
        "Last time we talked about your sleep.",
        "How did the worry diary go?",
        "Okay.",
      ]),
      sessionNumber: 3,
    });
    expect(check(later, "bridge").applicable).toBe(true);
    expect(check(later, "bridge").detected).toBe(true);
    expect(check(later, "homework_review").detected).toBe(true);
    expect(check(later, "role_intro").applicable).toBe(false);
  });

  it("expects safety planning only when the case carries risk", () => {
    const messages = convo([
      "What are the warning signs that things are getting worse?",
      "Who could you call if that happens?",
      "Could we keep the pills somewhere you can't easily reach?",
      "Here is the crisis line number.",
    ]);
    const noRisk = evaluateSessionPractice({ messages, riskPresent: false });
    expect(noRisk.groups.find((g) => g.group === "safety_plan")!.applicable).toBe(false);

    const risk = evaluateSessionPractice({ messages, riskPresent: true });
    const group = risk.groups.find((g) => g.group === "safety_plan")!;
    expect(group.applicable).toBe(true);
    expect(group.met).toBe(4);
    expect(check(risk, "internal_coping").detected).toBe(false);
  });

  it("reports measures for reference without expecting them", () => {
    const r = evaluateSessionPractice({
      messages: convo(["I'd like to go through the PHQ-9 with you."]),
    });
    expect(check(r, "phq9").detected).toBe(true);
    expect(r.groups.find((g) => g.group === "measures")!.applicable).toBe(false);
  });

  it("always carries its limitations", () => {
    const r = evaluateSessionPractice({ messages: [] });
    expect(r.limitations.join(" ")).toMatch(/not a validated/i);
  });
});

describe("windowRange", () => {
  it("uses at least three turns and about a third of the session", () => {
    expect(windowRange("opening", 2)).toEqual([0, 2]);
    expect(windowRange("opening", 20)).toEqual([0, 7]);
    expect(windowRange("closing", 20)).toEqual([13, 20]);
    expect(windowRange("any", 20)).toEqual([0, 20]);
  });
});

describe("caseHasRisk", () => {
  it("is true for any suicidal ideation or self-harm", () => {
    expect(caseHasRisk(null)).toBe(false);
    expect(caseHasRisk({ suicidal_ideation: "none" })).toBe(false);
    expect(caseHasRisk({ suicidal_ideation: "passive" })).toBe(true);
    expect(caseHasRisk({ suicidal_ideation: "none", self_harm: true })).toBe(true);
  });
});

describe("buildIndicativeCtsr", () => {
  const items: ScoreEntry[] = [
    { id: "alliance", label: "", score: 5, max: 5, weight: 10, feedback: "" },
    { id: "assessment", label: "", score: 3, max: 5, weight: 8, feedback: "" },
    { id: "clinical_formulation", label: "", score: 2, max: 5, weight: 10, feedback: "" },
    { id: "interventions", label: "", score: 4, max: 5, weight: 8, feedback: "" },
    { id: "structure", label: "", score: 5, max: 5, weight: 4, feedback: "" },
  ];

  it("rates all 12 items in CTS-R order and totals out of 72", () => {
    const practice = evaluateSessionPractice({ messages: EN_FIRST_SESSION });
    const ctsr = buildIndicativeCtsr({ items, practice });
    expect(ctsr.items.map((i) => i.id)).toEqual(CTSR_ITEM_ORDER);
    expect(ctsr.rated).toBe(12);
    expect(ctsr.total).not.toBeNull();
    expect(ctsr.total!).toBeLessThanOrEqual(72);
    expect(ctsr.items.find((i) => i.id === "collaboration")!.score).toBe(6);
    expect(ctsr.items.find((i) => i.id === "conceptual_integration")!.score).toBe(2);
    expect(ctsr.limitations.join(" ")).toMatch(/not validated/i);
  });

  it("leaves items unrated when a custom rubric has no matching ids", () => {
    const practice = evaluateSessionPractice({ messages: [] });
    const ctsr = buildIndicativeCtsr({
      items: [{ id: "custom", label: "", score: 3, max: 5, weight: 100, feedback: "" }],
      practice,
    });
    expect(ctsr.total).toBeNull();
    expect(ctsr.items.find((i) => i.id === "collaboration")!.source).toBe("none");
    // Checklist-sourced items still rate (agenda, feedback, homework).
    expect(ctsr.items.find((i) => i.id === "agenda_setting")!.score).toBe(0);
  });
});

function core(overrides: Partial<ClinicalCore> = {}): ClinicalCore {
  return {
    disorder: "Major depressive disorder",
    age: 34,
    gender: "female",
    severity: "moderate",
    symptom_profile: [
      { id: "low_mood", description: "low mood", domain: "mood" },
      { id: "insomnia", description: "early waking", domain: "sleep" },
      { id: "poor_focus", description: "poor focus", domain: "cognition" },
    ],
    disclosure_rules: [],
    session_goals: [],
    ideal_approach: "",
    risk_profile: { suicidal_ideation: "passive" },
    ...overrides,
  } as ClinicalCore;
}

describe("deriveSelfReportProfile", () => {
  it("is deterministic and keeps every item between 0 and 3", () => {
    const a = deriveSelfReportProfile(core());
    const b = deriveSelfReportProfile(core());
    expect(a).toEqual(b);
    expect(a.phq9.items).toHaveLength(9);
    expect(a.gad7.items).toHaveLength(7);
    for (const n of [...a.phq9.items, ...a.gad7.items]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it("rises with case severity", () => {
    const mild = deriveSelfReportProfile(core({ severity: "mild" })).phq9.total;
    const moderate = deriveSelfReportProfile(core({ severity: "moderate" })).phq9.total;
    const severe = deriveSelfReportProfile(core({ severity: "severe" })).phq9.total;
    expect(mild).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(severe);
  });

  it("ties PHQ-9 item 9 to the case risk profile", () => {
    expect(deriveSelfReportProfile(core({ risk_profile: { suicidal_ideation: "none" } })).phq9.items[8]).toBe(0);
    expect(deriveSelfReportProfile(core()).phq9.items[8]).toBe(1);
    expect(
      deriveSelfReportProfile(core({ risk_profile: { suicidal_ideation: "active_with_plan" } })).phq9.items[8],
    ).toBe(2);
  });

  it("keeps anxiety low for a depression case without anxiety symptoms", () => {
    const p = deriveSelfReportProfile(core());
    expect(p.gad7.total).toBeLessThan(p.phq9.total);
  });

  it("falls back on the disorder name when symptoms carry no domains", () => {
    const p = deriveSelfReportProfile(
      core({
        disorder: "Generalized anxiety disorder",
        symptom_profile: [{ id: "worry", description: "constant worry" }],
      }),
    );
    expect(p.gad7.total).toBeGreaterThan(p.phq9.total - p.phq9.items[8]!);
  });
});

describe("formatSelfReportForPrompt", () => {
  it("tells the patient to answer only when administered, without volunteering totals", () => {
    const block = formatSelfReportForPrompt(core());
    expect(block).toMatch(/only when the therapist administers/i);
    expect(block).toMatch(/Never volunteer a questionnaire, a total score, or a severity label/);
    expect(block).toMatch(/Module 4 risk disclosure/);
    expect(block).toMatch(/feeling down, depressed, or hopeless: more than half the days/);
    expect(block).not.toMatch(/PHQ-9 total/);
  });
});

describe("severityBand", () => {
  it("uses the published PHQ-9 and GAD-7 cut-offs", () => {
    expect(severityBand("phq9", 4)).toBe("minimal");
    expect(severityBand("phq9", 10)).toBe("moderate");
    expect(severityBand("phq9", 15)).toBe("moderately_severe");
    expect(severityBand("phq9", 20)).toBe("severe");
    expect(severityBand("gad7", 9)).toBe("mild");
    expect(severityBand("gad7", 15)).toBe("severe");
  });
});
