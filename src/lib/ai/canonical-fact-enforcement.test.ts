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
  recognitionOnlyAliases,
  resolveMedicationFacts,
  speechFormOf,
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

/**
 * Arabic sessions speak the medication name in ENGLISH inside an otherwise
 * Jordanian-Arabic sentence. Recognition is language-independent: English and
 * verified Arabic aliases resolve to the same canonical entity, so the same
 * fact is enforced whichever form either party uses.
 */
describe("MEDICATION", () => {
  it("6 — correct current medication confirmation passes", () => {
    expect(ok("آه، باخد propranolol عند الحاجة.")).toBe(true);
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
    // Same, with the therapist using the English name.
    expect(
      reason("آه، باخده.", {
        ...AR,
        therapistMessage: "أنت بتاخد sertraline خمسين مليغرام؟",
      }),
    ).toBe("medication_contradiction");
    expect(reason("باخد sertraline هلأ.")).toBe("medication_contradiction");
  });

  it("7b — anaphoric affirmation of a drug the patient DOES take passes", () => {
    expect(
      ok("آه، باخده عند الحاجة.", {
        ...AR,
        therapistMessage: "بتاخد propranolol؟",
      }),
    ).toBe(true);
  });

  it("7c — anaphoric denial passes", () => {
    expect(
      ok("لا، ما باخده.", {
        ...AR,
        therapistMessage: "باخذ sertraline خمسين مليغرام.",
      }),
    ).toBe(true);
  });

  it("7d — English and Arabic therapist forms resolve to the SAME entity", () => {
    for (const therapistMessage of [
      "أنت بتاخد سيرترالين.",
      "أنت بتاخد sertraline.",
      "أنت بتاخد Zoloft.",
    ]) {
      expect(
        reason("آه، باخده.", { ...AR, therapistMessage }),
        therapistMessage,
      ).toBe("medication_contradiction");
    }
  });

  it("8 — family medication adopted as the patient's is rejected", () => {
    expect(reason("آه، باخد sertraline.")).toBe("medication_contradiction");
    expect(reason("آه، باخد سيرترالين.")).toBe("medication_contradiction");
    expect(reason("I take sertraline.", EN)).toBe("medication_contradiction");
  });

  it("9 — correct family attribution passes, in either surface form", () => {
    expect(ok("أختي هبة بتاخد sertraline، مش أنا.")).toBe(true);
    expect(ok("أختي بتاخد سيرترالين.")).toBe(true);
    expect(ok("My sister takes sertraline.", EN)).toBe(true);
  });

  it("10 — wrong dose is rejected, digits or spoken Arabic numerals", () => {
    expect(reason("أخدت SSRI 50 ملغ.")).toBe("medication_contradiction");
    // "sertraline خمسين مليغرام" is acceptable SPEECH; the dose is still wrong.
    expect(reason("أخدت SSRI خمسين مليغرام.")).toBe("medication_contradiction");
    expect(reason("أخدت SSRI خمسين milligrams.")).toBe(
      "medication_contradiction",
    );
  });

  it("11 — correct dose passes, digits or spoken numerals", () => {
    expect(ok("أخدت SSRI 10 ملغ.")).toBe(true);
    expect(ok("أخدت SSRI عشرة ملغ.")).toBe(true);
    expect(ok("أخدته 10 milligrams لمدة ١٢ يوم وبعدين وقفت.")).toBe(true);
  });

  it("12 — wrong duration is rejected", () => {
    expect(reason("أخدت SSRI 30 يوم.")).toBe("medication_contradiction");
    expect(reason("أخدت SSRI ثلاثين يوم.")).toBe("medication_contradiction");
  });

  it("13 — correct duration passes", () => {
    expect(ok("أخدت SSRI 12 يوم وبعدين وقفت.")).toBe(true);
    expect(ok("أخدت SSRI اثنعش يوم وبعدين وقفت.")).toBe(true);
  });

  it("14 — a stopped medication presented as current is rejected", () => {
    expect(reason("باخد alprazolam هلأ.")).toBe("medication_contradiction");
    expect(reason("باخد ألبرازولام هلأ.")).toBe("medication_contradiction");
  });

  it("15 — a stopped medication correctly described passes", () => {
    expect(ok("أخدت alprazolam مرتين بس، وبطلت.")).toBe(true);
    expect(ok("كنت باخد الدوا وبعدين وقفت.")).toBe(true);
  });

  it("16 — a never-taken medication adopted is rejected", () => {
    expect(reason("باخده sertraline من شهر.")).toBe("medication_contradiction");
  });

  it("17 — a never-taken medication denied passes (the preferred speech form)", () => {
    expect(ok("أنا مش باخد sertraline.")).toBe(true);
    expect(ok("لا، أنا مش باخد سيرترالين.")).toBe(true);
    expect(ok("ما باخد sertraline أبداً.")).toBe(true);
    expect(ok("I don't take sertraline.", EN)).toBe(true);
  });

  it("does not fire merely because a drug name appears", () => {
    expect(ok("سمعت عن sertraline بس ما جربته.")).toBe(true);
    expect(ok("الدكتور حكالي عن سيرترالين.")).toBe(true);
  });

  it("is inert with no facts", () => {
    expect(detectMedicationContradiction("باخد sertraline.", [], "ar")).toBeNull();
    expect(
      detectMedicationContradiction("باخد sertraline.", undefined, "ar"),
    ).toBeNull();
  });
});

/* ─────────────────── SPEECH FORM vs RECOGNITION ALIASES ─────────────────── */

describe("naming rule — speech form is English, recognition is language-independent", () => {
  it("every fact speaks an English name", () => {
    for (const f of MEDS) {
      expect(/^[\x20-\x7E]+$/.test(speechFormOf(f)), f.id).toBe(true);
    }
  });

  it("sertraline speaks English but still recognises the Arabic alias", () => {
    const f = MEDS.find((m) => m.id === "sertraline-patient-never")!;
    expect(speechFormOf(f)).toBe("sertraline");
    expect(recognitionOnlyAliases(f)).toContain("سيرترالين");
  });

  it("EVERY fact is now enforceable in Arabic sessions", () => {
    // Previously hydroxyzine and the unnamed SSRI were unenforceable in Arabic
    // because they had no Arabic alias. Under the English-speech rule the
    // English form is what is spoken, so the gate no longer depends on it.
    for (const f of MEDS) {
      expect(enforceableIn(f), f.id).toBe(true);
    }
  });

  it("hydroxyzine — English-only — is enforced inside an Arabic sentence", () => {
    expect(reason("باخد hydroxyzine كل يوم هلأ.")).toBe(
      "medication_contradiction",
    );
    expect(ok("أخدت hydroxyzine أربع مرات وبطلت.")).toBe(true);
  });

  it("changing the spoken form changes no clinical field", () => {
    const never = MEDS.find((m) => m.id === "sertraline-patient-never")!;
    const sibling = MEDS.find((m) => m.id === "sertraline-sibling")!;
    expect(never.status).toBe("never_taken");
    expect(never.owner).toBe("patient");
    expect(sibling.status).toBe("current");
    expect(sibling.owner).toBe("family");
    const trial = MEDS.find((m) => m.id === "ssri-trial-stopped")!;
    expect(trial.dose_mg).toBe(10);
    expect(trial.duration_days).toBe(12);
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

  it("Arabic aliases are verified-only — none invented for speech", () => {
    // Arabic aliases exist ONLY where the form is already present in authored
    // case content. Recognition no longer depends on them (the English name is
    // what is spoken), so there is no pressure to machine-translate the rest.
    const withArabicAlias = MEDS.filter((m) =>
      m.agent_names.some((n) => /[\u0600-\u06FF]/.test(n)),
    ).map((m) => m.id);
    expect(withArabicAlias.sort()).toEqual(
      [
        "alprazolam-two-occasions", // ألبرازولام — ar-JO immutable facts
        "beta-blocker-current", // حاصرات بيتا — ar-JO immutable facts
        "sertraline-patient-never", // سيرترالين — repo + recorded session
        "sertraline-sibling",
      ].sort(),
    );
    // hydroxyzine and the unnamed SSRI still have no Arabic alias, and that is
    // correct: nothing was invented to fill the gap.
    for (const id of ["hydroxyzine-abandoned", "ssri-trial-stopped"]) {
      const f = MEDS.find((m) => m.id === id)!;
      expect(f.agent_names.some((n) => /[\u0600-\u06FF]/.test(n)), id).toBe(
        false,
      );
    }
  });

  it("resolves authored data first, slug fallback second", () => {
    expect(resolveMedicationFacts(undefined, "jordan-hale")).toBe(MEDS);
    expect(resolveMedicationFacts([], "jordan-hale")).toBe(MEDS);
    expect(resolveMedicationFacts(undefined, "unknown-slug")).toEqual([]);
    const authored = [{ id: "x" }] as never;
    expect(resolveMedicationFacts(authored, "jordan-hale")).toBe(authored);
  });
});
