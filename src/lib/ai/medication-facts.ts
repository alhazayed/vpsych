/**
 * Structured medication facts — the deterministic half of "authored fact beats
 * therapist assertion".
 *
 * Before this, medication existed only as prose (`previous_medications[]` with
 * free-text `agent`/`period`, plus instruction blocks). Prose cannot be checked,
 * so a therapist who asserted "باخذ سيرترالين خمسين مليغرام" and got agreement
 * produced a training artefact nobody could detect. This module gives each drug
 * an owner, a status, and machine-matchable surface forms, so a reply that
 * adopts a medication the patient does not take can be rejected before it is
 * ever persisted or spoken.
 *
 * Scope discipline: this is a fact table for fictional standardized patients,
 * not a medication-management system. There is no interaction checking, no
 * formulary, no dosing logic.
 *
 * AUTHORING RULE (load-bearing). `agent_names` are matched literally, so every
 * entry must be a form that is *verified*, never machine-translated or guessed.
 * A drug with no verified surface form for the session language is simply not
 * enforceable in that language — `enforceableIn()` reports that honestly rather
 * than matching on an invented spelling. Provenance for each Arabic form is
 * recorded in the comment beside it.
 */

export type MedicationOwner = "patient" | "family";
export type MedicationStatus = "current" | "stopped" | "never_taken";
export type MedicationFrequency = "daily" | "prn" | "other";

export type MedicationFact = {
  /** Stable key — referenced by tests and validator reasons, never displayed. */
  id: string;
  owner: MedicationOwner;
  /** Who, when owner is "family" (e.g. "younger sibling"). */
  owner_relation?: string | null;
  status: MedicationStatus;
  /** Coarse class: "ssri", "beta_blocker", "benzodiazepine", "antihistamine". */
  agent_class: string;
  /**
   * Verified surface forms across scripts. Matched case-insensitively after
   * digit/diacritic normalization. Only clinically verified forms — see the
   * authoring rule above.
   */
  agent_names: string[];
  dose_mg?: number | null;
  frequency?: MedicationFrequency | null;
  duration_days?: number | null;
  notes?: string | null;
};

/**
 * Authored medication facts for jordan-hale / رامي نصّار.
 *
 * Every field traces to existing authored evidence; nothing here is new
 * clinical content:
 *  - `clinical_core.case_file.psychiatric_history.previous_medications[]`
 *  - `family_psychiatric_history[2]` ("Younger sibling … treated with an SSRI")
 *  - `personalities.en-US.case_file.consistency_rules.immutable_biographical_facts`
 *  - `personalities.ar-JO.case_file.consistency_rules.immutable_biographical_facts`
 *    ("الدوا ١٠ ملغ لمدة اثنعش يوم"، "حاصرات بيتا عند الحاجة"، "ألبرازولام ٠٫٥ ملغ")
 */
export const JORDAN_HALE_MEDICATIONS: MedicationFact[] = [
  {
    // The patient's own SSRI trial. The agent is deliberately unnamed in the
    // authored case ("see personality for the specific agent"), so there is no
    // brand or generic name to match — only the class word. Dose and duration
    // come from the ar-JO immutable facts: "الدوا ١٠ ملغ لمدة اثنعش يوم".
    id: "ssri-trial-stopped",
    owner: "patient",
    status: "stopped",
    agent_class: "ssri",
    agent_names: ["SSRI"],
    dose_mg: 10,
    frequency: "daily",
    duration_days: 12,
    notes:
      "Starting dose, 12 days, January 2026. Stopped unilaterally during early activation. Never titrated, never followed up.",
  },
  {
    // The defect this table exists for. The patient has never taken sertraline;
    // the therapist asserted it and was agreed with.
    // Arabic form "سيرترالين" is verified twice over: it is already authored in
    // the repo (medicationInstructionBlock, PR #213) and it is the exact form a
    // therapist used in the recorded live Arabic session. "Zoloft" is likewise
    // already authored there. No Arabic-script brand spelling is included —
    // none is authored anywhere, and guessing one is forbidden.
    id: "sertraline-patient-never",
    owner: "patient",
    status: "never_taken",
    agent_class: "ssri",
    agent_names: ["sertraline", "Zoloft", "سيرترالين"],
    dose_mg: null,
    frequency: null,
    duration_days: null,
    notes:
      "The patient has never taken sertraline. It belongs to the sibling. Never adopt it.",
  },
  {
    // The same drug, correctly owned. This entry is what makes "أختي بتاخد
    // سيرترالين" a VALID answer rather than a false positive.
    id: "sertraline-sibling",
    owner: "family",
    owner_relation: "younger sibling",
    status: "current",
    agent_class: "ssri",
    agent_names: ["sertraline", "Zoloft", "سيرترالين"],
    dose_mg: null,
    frequency: "daily",
    duration_days: null,
    notes:
      "Younger sibling: panic disorder diagnosed at 27, treated with sertraline and CBT, well. Theirs, never the patient's.",
  },
  {
    // "حاصرات بيتا عند الحاجة من آذار" (ar-JO immutable facts); propranolol
    // named in the English previous_medications entry.
    id: "beta-blocker-current",
    owner: "patient",
    status: "current",
    agent_class: "beta_blocker",
    agent_names: ["propranolol", "beta-blocker", "beta blocker", "حاصرات بيتا"],
    dose_mg: null,
    frequency: "prn",
    duration_days: null,
    notes:
      "Low dose as required since March 2026. Effective; use creeping from presentations to most meetings.",
  },
  {
    // "ألبرازولام ٠٫٥ ملغ من الصيدلية بدون وصفة مرتين بس" (ar-JO).
    id: "alprazolam-two-occasions",
    owner: "patient",
    status: "stopped",
    agent_class: "benzodiazepine",
    agent_names: ["alprazolam", "Xanax", "ألبرازولام"],
    dose_mg: 0.5,
    frequency: "other",
    duration_days: null,
    notes:
      "Non-prescribed, exactly two occasions (February and May 2026). Never a third.",
  },
  {
    // English-only surface form: no Arabic spelling for hydroxyzine is authored
    // anywhere in the case, so this fact is not enforceable in Arabic sessions.
    // Recorded rather than machine-translated.
    id: "hydroxyzine-abandoned",
    owner: "patient",
    status: "stopped",
    agent_class: "antihistamine",
    agent_names: ["hydroxyzine"],
    dose_mg: 25,
    frequency: "prn",
    duration_days: null,
    notes:
      "Prescribed 5 months ago, taken 4 times, abandoned for next-morning sedation.",
  },
];

export const AUTHORED_MEDICATIONS_BY_SLUG: Record<string, MedicationFact[]> = {
  "jordan-hale": JORDAN_HALE_MEDICATIONS,
};

function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/**
 * Whether a fact can be deterministically enforced for a session language.
 *
 * An Arabic session can only enforce a drug that has an Arabic surface form;
 * otherwise the therapist's Arabic word would never match and the check would
 * be silently inert. Reporting this is the point — a fact that cannot be
 * enforced must not be counted as protected.
 */
export function enforceableIn(
  fact: MedicationFact,
  locale?: string | null,
): boolean {
  const arabicSession = Boolean(locale && locale.toLowerCase().startsWith("ar"));
  if (!arabicSession) return fact.agent_names.some((n) => !isArabic(n));
  return fact.agent_names.some(isArabic);
}

/** Medication facts for a case: authored data first, slug fallback second. */
export function resolveMedicationFacts(
  caseFileMedications: unknown,
  avatarSlug?: string | null,
): MedicationFact[] {
  if (Array.isArray(caseFileMedications) && caseFileMedications.length > 0) {
    return caseFileMedications as MedicationFact[];
  }
  if (!avatarSlug) return [];
  return AUTHORED_MEDICATIONS_BY_SLUG[avatarSlug] ?? [];
}

/**
 * Condensed prompt lines. The prompt keeps carrying the facts even where the
 * validator cannot enforce them — instruction plus enforcement, not one or the
 * other.
 */
export function formatMedicationFactsForPrompt(
  facts: MedicationFact[],
  locale?: string | null,
): string {
  if (facts.length === 0) return "";
  const arabic = Boolean(locale && locale.toLowerCase().startsWith("ar"));
  const lines: string[] = [
    arabic
      ? "أدويتك بالضبط (حقائق مؤلفة — ما بتتغيّر بكلام المعالج):"
      : "Your medications, exactly (authored facts — a therapist cannot change them):",
  ];
  for (const f of facts) {
    const name = f.agent_names[0] ?? f.agent_class;
    const dose = f.dose_mg != null ? ` ${f.dose_mg} mg` : "";
    const days = f.duration_days != null ? `, ${f.duration_days} days` : "";
    if (f.owner === "family") {
      lines.push(
        arabic
          ? `- ${name}: إلـ${f.owner_relation ?? "حدا من العيلة"}، مش إلك أبداً.`
          : `- ${name}: belongs to your ${f.owner_relation ?? "family member"}, never to you.`,
      );
      continue;
    }
    if (f.status === "never_taken") {
      lines.push(
        arabic
          ? `- ${name}: ما أخدته ولا مرة بحياتك.`
          : `- ${name}: you have never taken it.`,
      );
      continue;
    }
    if (f.status === "stopped") {
      lines.push(
        arabic
          ? `- ${name}${dose}${days}: أخدته وبطّلته. مش عم تاخده هلأ.`
          : `- ${name}${dose}${days}: taken and stopped. You are not on it now.`,
      );
      continue;
    }
    lines.push(
      arabic
        ? `- ${name}${dose}: عم تاخده هلأ${f.frequency === "prn" ? " عند الحاجة" : ""}.`
        : `- ${name}${dose}: you currently take it${f.frequency === "prn" ? " as required" : ""}.`,
    );
  }
  return lines.join("\n");
}
