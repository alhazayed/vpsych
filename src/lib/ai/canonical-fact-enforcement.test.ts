/**
 * P0 canonical-fact enforcement — deterministic age + medication guards.
 *
 * Both directions matter equally. Positive cases prove a contradiction is
 * caught; negative cases prove a CORRECT answer is never punished, because a
 * validator that rejects correct replies just burns regenerations and teaches
 * nothing.
 */

import { describe, expect, it } from "vitest";
import {
  detectAgeContradiction,
  detectMedicationContradiction,
  validatePatientReply,
  type CanonicalReplyFacts,
} from "@/lib/ai/reply-validation";
import {
  JORDAN_HALE_MEDICATIONS,
  enforceableIn,
  resolveMedicationFacts,
} from "@/lib/ai/medication-facts";

const AGE = 34;
const MEDS = JORDAN_HALE_MEDICATIONS;
const AR: CanonicalReplyFacts = { age: AGE, medications: MEDS, locale: "ar-JO" };
const EN: CanonicalReplyFacts = { age: AGE, medications: MEDS, locale: "en-US" };

const ok = (t: string, f = AR) => validatePatientReply(t, f).ok;
const reason = (t: string, f = AR) => {
  const v = validatePatientReply(t, f);
  return v.ok ? null : v.reason;
};

/* ───────────────────────────── AGE (1–5) ───────────────────────────── */

describe("AGE", () => {
  it("1 — correct age confirmation passes", () => {
    expect(ok("آه، عمري ٣٤.")).toBe(true);
    expect(ok("٣٤ سنة.")).toBe(true);
    expect(ok("I'm 34.", EN)).toBe(true);
  });

  it("2 — wrong age adoption is rejected (the live failure)", () => {
    expect(reason("آه، ٣٥.")).toBe("age_contradiction");
    expect(reason("عمري ٣٥.")).toBe("age_contradiction");
    expect(reason("I'm 35.", EN)).toBe("age_contradiction");
  });

  it("3 — wrong age CORRECTION passes", () => {
    expect(ok("لا، عمري ٣٤.")).toBe(true);
    expect(ok("لا، مش ٣٥، عمري ٣٤.")).toBe(true);
    expect(ok("No, I'm 34, not 35.", EN)).toBe(true);
  });

  it("4 — the wrong number appearing inside a denial does not fail", () => {
    expect(ok("مش ٣٥.")).toBe(true);
    expect(ok("لأ، مش هيك.")).toBe(true);
    // Affirmation AND denial in one turn, wrong number present, canonical
    // absent — the shape a real correction takes ("yeah, well, no, not 35").
    // Only the denial guard saves this one.
    expect(ok("آه، بس مش ٣٥.")).toBe(true);
    expect(ok("Yeah, no, not 35.", EN)).toBe(true);
  });

  it("5 — unrelated numbers are ignored", () => {
    expect(ok("بشرب ٥ فناجين قهوة باليوم.")).toBe(true);
    expect(ok("راتبي ١٢٥٠ دينار.")).toBe(true);
    expect(ok("أخدته ١٢ يوم وبعدين وقفت.")).toBe(true);
    expect(ok("لما كان عمري ١٢ صرت أفكر هيك.")).toBe(true);
    expect(ok("أبوي أجته جلطة وعمره ٥٨.")).toBe(true);
  });

  it("is inert without a canonical age", () => {
    expect(detectAgeContradiction("آه، ٣٥.", null)).toBeNull();
  });
});

/* ────────────────────────── MEDICATION (6–17) ────────────────────────── */

describe("MEDICATION", () => {
  it("6 — correct current medication confirmation passes", () => {
    expect(ok("آه، باخد حاصرات بيتا عند الحاجة.")).toBe(true);
  });

  it("7 — false medication adoption is rejected (the live failure)", () => {
    // The recorded failure. The reply names no drug — only the therapist did.
    expect(
      reason("آه، باخده. خمسين الصبح.", {
        ...AR,
        therapistMessage: "باخذ سيرترالين خمسين مليغرام بالصبح.",
      }),
    ).toBe("medication_contradiction");
    expect(reason("باخد سيرترالين هلأ.")).toBe("medication_contradiction");
  });

  it("7b — anaphoric affirmation of a drug the patient DOES take passes", () => {
    expect(
      ok("آه، باخده عند الحاجة.", {
        ...AR,
        therapistMessage: "بتاخد حاصرات بيتا؟",
      }),
    ).toBe(true);
  });

  it("7c — anaphoric denial passes", () => {
    expect(
      ok("لا، ما باخده.", {
        ...AR,
        therapistMessage: "باخذ سيرترالين خمسين مليغرام.",
      }),
    ).toBe(true);
  });

  it("8 — family medication adopted as the patient's is rejected", () => {
    expect(reason("آه، باخد سيرترالين.")).toBe("medication_contradiction");
    expect(reason("I take sertraline.", EN)).toBe("medication_contradiction");
  });

  it("9 — correct family attribution passes", () => {
    expect(ok("أختي هبة بتاخد سيرترالين، مش أنا.")).toBe(true);
    expect(ok("أختي بتاخد سيرترالين.")).toBe(true);
    expect(ok("My sister takes sertraline.", EN)).toBe(true);
  });

  it("10 — wrong dose is rejected", () => {
    expect(reason("أخدت الدوا خمسين ملغ.", AR)).toBe(null); // spelled-out: out of scope
    expect(reason("أخدت SSRI 50 ملغ.", EN)).toBe("medication_contradiction");
  });

  it("11 — correct dose passes", () => {
    expect(ok("أخدت SSRI 10 ملغ.", EN)).toBe(true);
  });

  it("12 — wrong duration is rejected", () => {
    expect(reason("أخدت SSRI 30 يوم.", EN)).toBe("medication_contradiction");
  });

  it("13 — correct duration passes", () => {
    expect(ok("أخدت SSRI 12 يوم وبعدين وقفت.", EN)).toBe(true);
  });

  it("14 — a stopped medication presented as current is rejected", () => {
    expect(reason("باخد ألبرازولام هلأ.")).toBe("medication_contradiction");
  });

  it("15 — a stopped medication correctly described passes", () => {
    expect(ok("أخدت ألبرازولام مرتين بس، وبطلت.")).toBe(true);
    expect(ok("كنت باخد الدوا وبعدين وقفت.")).toBe(true);
  });

  it("16 — a never-taken medication adopted is rejected", () => {
    expect(reason("باخده سيرترالين من شهر.")).toBe("medication_contradiction");
  });

  it("17 — a never-taken medication denied passes", () => {
    expect(ok("لا، أنا مش باخد سيرترالين.")).toBe(true);
    expect(ok("ما باخد سيرترالين أبداً.")).toBe(true);
    expect(ok("I don't take sertraline.", EN)).toBe(true);
  });

  it("does not fire merely because a drug name appears", () => {
    expect(ok("سمعت عن سيرترالين بس ما جربته.")).toBe(true);
    expect(ok("الدكتور حكالي عن سيرترالين.")).toBe(true);
  });

  it("is inert with no facts", () => {
    expect(detectMedicationContradiction("باخد سيرترالين.", [], "ar")).toBeNull();
    expect(
      detectMedicationContradiction("باخد سيرترالين.", undefined, "ar"),
    ).toBeNull();
  });
});

/* ─────────────────────────── CONTENT (18–21) ─────────────────────────── */

describe("CONTENT", () => {
  it("18 — empty response rejected", () => {
    expect(reason("")).toBe("empty");
    expect(reason("   ")).toBe("empty");
  });

  it("19 — punctuation-only rejected", () => {
    expect(reason(".")).toBe("punctuation_only");
  });

  it("20 — ellipsis-only rejected", () => {
    expect(reason("…")).toBe("ellipsis_only");
    expect(reason("يعني… …")).toBe("ellipsis_only");
  });

  it("21 — valid short answers pass", () => {
    for (const t of ["آه.", "لا.", "مش كثير.", "يمكن.", "ممكن."]) {
      expect(ok(t), t).toBe(true);
    }
  });
});

/* ────────────────────────── PIPELINE (22–26) ────────────────────────── */

describe("PIPELINE — regenerate once, persist/TTS only when valid", () => {
  async function gate(first: string, second: string, fallback = "آه.") {
    const persisted: string[] = [];
    const spoken: string[] = [];
    let calls = 0;
    const generate = async () => {
      calls += 1;
      return calls === 1 ? first : second;
    };

    let text = await generate();
    if (!validatePatientReply(text, AR).ok) {
      text = await generate();
      if (!validatePatientReply(text, AR).ok) text = fallback;
    }
    if (validatePatientReply(text, AR).ok) {
      persisted.push(text);
      spoken.push(text);
    }
    return { persisted, spoken, calls, text };
  }

  it("22 — an invalid reply is never persisted", async () => {
    const r = await gate("آه، ٣٥.", "لا، عمري ٣٤.");
    expect(r.persisted).toEqual(["لا، عمري ٣٤."]);
    expect(r.persisted).not.toContain("آه، ٣٥.");
  });

  it("23 — an invalid reply is never sent to TTS", async () => {
    const r = await gate("آه، باخد سيرترالين.", "أختي بتاخد سيرترالين، مش أنا.");
    expect(r.spoken).toEqual(["أختي بتاخد سيرترالين، مش أنا."]);
    expect(r.spoken).not.toContain("آه، باخد سيرترالين.");
  });

  it("24 — at most ONE regeneration, then fallback", async () => {
    const r = await gate("آه، ٣٥.", "آه، ٣٦.");
    expect(r.calls).toBe(2);
    expect(r.text).toBe("آه.");
    expect(validatePatientReply(r.text, AR).ok).toBe(true);
  });

  it("25 — a valid regenerated reply is persisted", async () => {
    const r = await gate("…", "مش كثير.");
    expect(r.calls).toBe(2);
    expect(r.persisted).toEqual(["مش كثير."]);
  });

  it("26 — a valid regenerated reply is spoken", async () => {
    const r = await gate("آه، ٣٥.", "عمري ٣٤.");
    expect(r.spoken).toEqual(["عمري ٣٤."]);
  });
});

/* ───────────────────────── authored fact table ───────────────────────── */

describe("authored medication facts", () => {
  it("separates the patient's SSRI from the sister's sertraline", () => {
    const never = MEDS.find((m) => m.id === "sertraline-patient-never")!;
    const sibling = MEDS.find((m) => m.id === "sertraline-sibling")!;
    expect(never.owner).toBe("patient");
    expect(never.status).toBe("never_taken");
    expect(sibling.owner).toBe("family");
    expect(sibling.owner_relation).toBe("younger sibling");
    // The patient's own trial is a different fact with its own dose/duration.
    const trial = MEDS.find((m) => m.id === "ssri-trial-stopped")!;
    expect(trial.status).toBe("stopped");
    expect(trial.dose_mg).toBe(10);
    expect(trial.duration_days).toBe(12);
    expect(trial.agent_names).not.toContain("sertraline");
  });

  it("only claims Arabic enforceability where an Arabic form is authored", () => {
    const ar = MEDS.filter((m) => enforceableIn(m, "ar-JO")).map((m) => m.id);
    expect(ar).toContain("sertraline-patient-never");
    expect(ar).toContain("sertraline-sibling");
    expect(ar).toContain("beta-blocker-current");
    expect(ar).toContain("alprazolam-two-occasions");
    // No Arabic spelling is authored for these two — not machine-translated.
    expect(ar).not.toContain("hydroxyzine-abandoned");
    expect(ar).not.toContain("ssri-trial-stopped");
  });

  it("resolves authored data first, slug fallback second", () => {
    expect(resolveMedicationFacts(undefined, "jordan-hale")).toBe(MEDS);
    expect(resolveMedicationFacts([], "jordan-hale")).toBe(MEDS);
    expect(resolveMedicationFacts(undefined, "unknown-slug")).toEqual([]);
    const authored = [{ id: "x" }] as never;
    expect(resolveMedicationFacts(authored, "jordan-hale")).toBe(authored);
  });
});
