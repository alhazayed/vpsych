import type {
  CaseEngineCatalog,
  CaseGenerationRequest,
  CaseValidationIssue,
  CaseValidationResult,
  ComorbidityRule,
  DisorderRow,
  PersonaRow,
} from "@/lib/case-engine/types";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";

const UNSAFE_MED_COMBOS: Array<[string, string]> = [
  // Placeholder clinical safety pairs (slug-level) — extend with formulary later
  ["maoi", "ssri"],
];

function issue(code: string, message: string, path?: string): CaseValidationIssue {
  return { code, message, path };
}

export function validateAgeDisorder(
  persona: PersonaRow,
  disorder: DisorderRow,
): CaseValidationIssue[] {
  const age = persona.identity?.age;
  const out: CaseValidationIssue[] = [];
  if (typeof age !== "number" || Number.isNaN(age)) {
    out.push(issue("persona.age_missing", "Persona age is required", "persona.identity.age"));
    return out;
  }
  if (disorder.min_age != null && age < disorder.min_age) {
    out.push(
      issue(
        "age_disorder_incompatible",
        `Age ${age} below minimum ${disorder.min_age} for ${disorder.slug}`,
        "persona.identity.age",
      ),
    );
  }
  if (disorder.max_age != null && age > disorder.max_age) {
    out.push(
      issue(
        "age_disorder_incompatible",
        `Age ${age} above maximum ${disorder.max_age} for ${disorder.slug}`,
        "persona.identity.age",
      ),
    );
  }
  return out;
}

export function validateGenderDisorder(
  persona: PersonaRow,
  disorder: DisorderRow,
): CaseValidationIssue[] {
  const gender = persona.identity?.gender ?? "unspecified";
  const allowed = disorder.allowed_genders?.length
    ? disorder.allowed_genders
    : ["female", "male", "non-binary", "unspecified"];
  if (!allowed.includes(gender)) {
    return [
      issue(
        "gender_disorder_incompatible",
        `Gender ${gender} not allowed for ${disorder.slug}`,
        "persona.identity.gender",
      ),
    ];
  }
  return [];
}

export function findComorbidityRule(
  primaryId: string,
  comorbidId: string,
  rules: ComorbidityRule[],
): ComorbidityRule | undefined {
  return rules.find(
    (r) =>
      r.primary_disorder_id === primaryId &&
      r.comorbid_disorder_id === comorbidId,
  );
}

export function validateComorbidities(
  primary: DisorderRow,
  comorbidities: DisorderRow[],
  rules: ComorbidityRule[],
): CaseValidationIssue[] {
  const out: CaseValidationIssue[] = [];
  const seen = new Set<string>();
  for (const c of comorbidities) {
    if (c.id === primary.id || c.slug === primary.slug) {
      out.push(
        issue(
          "comorbidity_duplicate_primary",
          `Comorbidity ${c.slug} duplicates primary diagnosis`,
          "comorbidities",
        ),
      );
      continue;
    }
    if (seen.has(c.id)) {
      out.push(
        issue(
          "comorbidity_duplicate",
          `Duplicate comorbidity ${c.slug}`,
          "comorbidities",
        ),
      );
      continue;
    }
    seen.add(c.id);
    const rule = findComorbidityRule(primary.id, c.id, rules);
    if (!rule) {
      out.push(
        issue(
          "comorbidity_unlisted",
          `No comorbidity rule for ${primary.slug} + ${c.slug}`,
          "comorbidities",
        ),
      );
    } else if (!rule.compatible || rule.tier === "impossible") {
      out.push(
        issue(
          "comorbidity_incompatible",
          `Incompatible comorbidity: ${primary.slug} + ${c.slug}`,
          "comorbidities",
        ),
      );
    }
  }
  return out;
}

export function validateDsmIcd(disorder: DisorderRow): CaseValidationIssue[] {
  const out: CaseValidationIssue[] = [];
  if (!disorder.dsm5_code) {
    out.push(issue("dsm5_missing", `Missing DSM-5 code for ${disorder.slug}`, "dsm5_code"));
  }
  if (!disorder.icd11_code) {
    out.push(issue("icd11_missing", `Missing ICD-11 code for ${disorder.slug}`, "icd11_code"));
  }
  return out;
}

export function validateMedicationSafety(
  primary: DisorderRow,
  comorbidities: DisorderRow[],
): CaseValidationIssue[] {
  const tags = [primary.slug, ...comorbidities.map((c) => c.slug)].join(" ");
  const out: CaseValidationIssue[] = [];
  for (const [a, b] of UNSAFE_MED_COMBOS) {
    if (tags.includes(a) && tags.includes(b)) {
      out.push(
        issue(
          "unsafe_medication_combination",
          `Unsafe medication combination tags: ${a} + ${b}`,
          "medications",
        ),
      );
    }
  }
  return out;
}

/** Full validation for a case generation request. */
export function validateCaseGeneration(
  req: CaseGenerationRequest,
  catalog: CaseEngineCatalog = getBuiltinCatalog(),
): CaseValidationResult {
  const issues: CaseValidationIssue[] = [];

  if (!req.persona?.is_active) {
    issues.push(issue("persona_inactive", "Persona is inactive", "persona"));
  }
  if (!req.primaryDisorder?.is_active) {
    issues.push(issue("disorder_inactive", "Primary disorder is inactive", "primaryDisorder"));
  }
  if (!req.avatarId) {
    issues.push(issue("avatar_required", "avatarId is required", "avatarId"));
  }

  issues.push(...validateDsmIcd(req.primaryDisorder));
  issues.push(...validateAgeDisorder(req.persona, req.primaryDisorder));
  issues.push(...validateGenderDisorder(req.persona, req.primaryDisorder));

  const comorbidities = req.comorbidities ?? [];
  for (const c of comorbidities) {
    if (!c.is_active) {
      issues.push(issue("comorbidity_inactive", `Comorbidity inactive: ${c.slug}`, "comorbidities"));
    }
    issues.push(...validateAgeDisorder(req.persona, c));
    issues.push(...validateGenderDisorder(req.persona, c));
    issues.push(...validateDsmIcd(c));
  }
  issues.push(
    ...validateComorbidities(req.primaryDisorder, comorbidities, catalog.comorbidityRules),
  );
  issues.push(...validateMedicationSafety(req.primaryDisorder, comorbidities));

  const diff = catalog.difficultyProfiles.find((d) => d.level === req.difficulty);
  if (!diff?.is_active) {
    issues.push(
      issue("difficulty_invalid", `Unknown or inactive difficulty: ${req.difficulty}`, "difficulty"),
    );
  }
  const therapy = catalog.therapyProfiles.find((t) => t.modality === req.therapyModality);
  if (!therapy?.is_active) {
    issues.push(
      issue(
        "therapy_invalid",
        `Unknown or inactive therapy modality: ${req.therapyModality}`,
        "therapyModality",
      ),
    );
  }

  if (!req.locale || !/^[a-z]{2}(-[A-Z]{2})?$/i.test(req.locale)) {
    issues.push(issue("locale_invalid", `Invalid locale: ${req.locale}`, "locale"));
  }

  return issues.length ? { ok: false, issues } : { ok: true };
}
