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
 * THREE SEPARATE THINGS, deliberately not collapsed:
 *
 *   1. CANONICAL ENTITY — the fact itself (owner, status, dose, duration). It is
 *      language-independent and never changes with pronunciation.
 *   2. SPEECH FORM (`speech_form`) — what the patient SAYS. For Arabic sessions
 *      the default is the ENGLISH name: Jordanian clinicians and patients say
 *      "sertraline" inside an Arabic sentence, and an Arabic transliteration is
 *      often less clinically recognisable, not more. "أنا مش باخد sertraline."
 *      is the target, not a fully-Arabised sentence.
 *   3. RECOGNITION ALIASES (`agent_names`) — every verified form the VALIDATOR
 *      must match, in any script. Recognition is language-independent: a
 *      therapist saying "sertraline" and one saying "سيرترالين" refer to the
 *      same canonical entity and both must resolve.
 *
 * Changing the spoken form must never change identity, ownership, status, dose,
 * frequency or duration.
 *
 * AUTHORING RULE (load-bearing). `agent_names` are matched literally, so every
 * alias must be *verified* — already present in authored case content,
 * clinician-authored, or explicitly approved for this avatar. Never
 * machine-translated, never a guessed brand name. An absent Arabic alias is a
 * recognition gap for therapist input only; it does not make the fact
 * unenforceable, because the English alias is matched in Arabic sessions too.
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
   * What the patient SAYS. English by default, including in Arabic sessions —
   * see the module header. Optional: falls back to the first non-Arabic alias.
   */
  speech_form?: string;
  /**
   * Every verified surface form the validator must RECOGNISE, across scripts.
   * Matched case-insensitively after digit/diacritic normalization. Only
   * clinically verified forms — see the authoring rule above.
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
    speech_form: "SSRI",
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
    speech_form: "sertraline",
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
    speech_form: "sertraline",
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
    speech_form: "propranolol",
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
    speech_form: "alprazolam",
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
    speech_form: "hydroxyzine",
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
 * Whether a fact can be deterministically enforced.
 *
 * Language-independent by design. Recognition matches EVERY verified alias
 * regardless of session locale, because the medication name is expected to be
 * spoken in English inside an Arabic conversation — gating Arabic sessions on
 * an Arabic alias would have made the English form, the one actually spoken,
 * invisible to the validator.
 *
 * Takes no locale on purpose: there is nothing locale-dependent left to decide.
 * A clinically-justified per-locale exception would add the parameter back
 * along with the rule that needs it.
 */
export function enforceableIn(fact: MedicationFact): boolean {
  return fact.agent_names.some((n) => n.trim().length > 2);
}

/** The form the patient should speak: authored, else the first Latin alias. */
export function speechFormOf(fact: MedicationFact): string {
  if (fact.speech_form?.trim()) return fact.speech_form.trim();
  return (
    fact.agent_names.find((n) => !isArabic(n)) ??
    fact.agent_names[0] ??
    fact.agent_class
  );
}

/** Verified aliases that are NOT the spoken form — recognition-only. */
export function recognitionOnlyAliases(fact: MedicationFact): string[] {
  const spoken = speechFormOf(fact).toLowerCase();
  return fact.agent_names.filter((n) => n.toLowerCase() !== spoken);
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
  if (arabic) {
    // Medication names are said in English inside the Arabic sentence. This is
    // how Jordanian clinicians and patients actually speak, and the English
    // name is the more clinically recognisable token. The rest of the turn
    // stays natural Jordanian Arabic — this is a naming rule, not a language
    // switch, and it changes nothing about the facts themselves.
    lines.push(
      "أسماء الأدوية: احكيها بالإنجليزي جوّا الجملة العربية — مثل «أنا مش باخد sertraline.» أو «أخدته 10 milligrams لمدة ١٢ يوم وبعدين وقفت.» باقي الحكي بيضل عربي أردني طبيعي. ما تترجم اسم الدوا للعربي غصب؛ وإذا طلع منك الاسم بالعربي بشكل طبيعي فهو مقبول. الجرعة والمدة والملكية ما بتتغير مهما كان لفظ الاسم.",
    );
  }
  for (const f of facts) {
    const name = speechFormOf(f);
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
