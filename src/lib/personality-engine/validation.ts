import {
  ATTACHMENT_STYLES,
  COPING_STYLES,
  EMOTIONAL_REGULATION_STYLES,
  HUMOR_STYLES,
  TRAIT_SCALE_MAX,
  TRAIT_SCALE_MIN,
  type HumanPersonalityProfile,
  type PersonalityValidationIssue,
  type PersonalityValidationResult,
  type TraitScale,
} from "./types";

function issue(
  code: string,
  message: string,
  path?: string,
  severity: "error" | "warning" = "error",
): PersonalityValidationIssue {
  return { code, message, path, severity };
}

function isTraitScale(value: unknown): value is TraitScale {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= TRAIT_SCALE_MIN &&
    value <= TRAIT_SCALE_MAX
  );
}

function requireNonEmptyString(
  value: unknown,
  path: string,
  code: string,
): PersonalityValidationIssue | null {
  if (typeof value !== "string" || !value.trim()) {
    return issue(code, `${path} is required`, path);
  }
  return null;
}

function requireStringArray(
  value: unknown,
  path: string,
  min = 1,
): PersonalityValidationIssue[] {
  if (!Array.isArray(value)) {
    return [issue(`${path}_type`, `${path} must be an array`, path)];
  }
  const out: PersonalityValidationIssue[] = [];
  if (value.length < min) {
    out.push(
      issue(`${path}_empty`, `${path} needs at least ${min} item(s)`, path),
    );
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string" || !String(value[i]).trim()) {
      out.push(
        issue(`${path}_item`, `${path}[${i}] must be a non-empty string`, `${path}[${i}]`),
      );
    }
  }
  return out;
}

/**
 * Validate a candidate human personality profile.
 * Fails closed: GPT must never invent missing trait keys.
 */
export function validateHumanPersonality(
  raw: unknown,
): PersonalityValidationResult {
  const issues: PersonalityValidationIssue[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      issues: [issue("profile_type", "Profile must be an object")],
    };
  }

  const p = raw as Record<string, unknown>;

  if (p.version !== 1) {
    issues.push(issue("version", "version must be 1", "version"));
  }

  const localeIssue = requireNonEmptyString(p.locale, "locale", "locale_required");
  if (localeIssue) issues.push(localeIssue);

  for (const [key, code] of [
    ["temperament", "temperament_required"],
    ["attachment_notes", "attachment_notes_required"],
    ["education", "education_required"],
    ["occupation", "occupation_required"],
    ["culture", "culture_required"],
    ["religion", "religion_required"],
    ["coping_notes", "coping_notes_required"],
    ["humor_notes", "humor_notes_required"],
    ["trust_notes", "trust_notes_required"],
    ["emotional_regulation_notes", "emotional_regulation_notes_required"],
    ["speech_style", "speech_style_required"],
    ["treatment_expectations", "treatment_expectations_required"],
  ] as const) {
    const err = requireNonEmptyString(p[key], key, code);
    if (err) issues.push(err);
  }

  if (
    typeof p.attachment_style !== "string" ||
    !ATTACHMENT_STYLES.includes(p.attachment_style as (typeof ATTACHMENT_STYLES)[number])
  ) {
    issues.push(
      issue(
        "attachment_style_invalid",
        `attachment_style must be one of: ${ATTACHMENT_STYLES.join(", ")}`,
        "attachment_style",
      ),
    );
  }

  if (
    typeof p.coping_style !== "string" ||
    !COPING_STYLES.includes(p.coping_style as (typeof COPING_STYLES)[number])
  ) {
    issues.push(
      issue(
        "coping_style_invalid",
        `coping_style must be one of: ${COPING_STYLES.join(", ")}`,
        "coping_style",
      ),
    );
  }

  if (
    typeof p.humor !== "string" ||
    !HUMOR_STYLES.includes(p.humor as (typeof HUMOR_STYLES)[number])
  ) {
    issues.push(
      issue(
        "humor_invalid",
        `humor must be one of: ${HUMOR_STYLES.join(", ")}`,
        "humor",
      ),
    );
  }

  if (
    typeof p.emotional_regulation !== "string" ||
    !EMOTIONAL_REGULATION_STYLES.includes(
      p.emotional_regulation as (typeof EMOTIONAL_REGULATION_STYLES)[number],
    )
  ) {
    issues.push(
      issue(
        "emotional_regulation_invalid",
        `emotional_regulation must be one of: ${EMOTIONAL_REGULATION_STYLES.join(", ")}`,
        "emotional_regulation",
      ),
    );
  }

  for (const key of [
    "resilience",
    "openness",
    "agreeableness",
    "conscientiousness",
    "neuroticism",
    "trust_level",
  ] as const) {
    if (!isTraitScale(p[key])) {
      issues.push(
        issue(
          `${key}_scale`,
          `${key} must be an integer ${TRAIT_SCALE_MIN}–${TRAIT_SCALE_MAX}`,
          key,
        ),
      );
    }
  }

  const intel = p.intelligence;
  if (!intel || typeof intel !== "object" || Array.isArray(intel)) {
    issues.push(issue("intelligence_required", "intelligence is required", "intelligence"));
  } else {
    const i = intel as Record<string, unknown>;
    const bands = ["average", "above_average", "high", "very_high"];
    if (typeof i.band !== "string" || !bands.includes(i.band)) {
      issues.push(
        issue(
          "intelligence_band",
          `intelligence.band must be one of: ${bands.join(", ")}`,
          "intelligence.band",
        ),
      );
    }
    issues.push(...requireStringArray(i.strengths, "intelligence.strengths", 1));
    const styleErr = requireNonEmptyString(
      i.style,
      "intelligence.style",
      "intelligence_style",
    );
    if (styleErr) issues.push(styleErr);
  }

  const vocab = p.vocabulary;
  if (!vocab || typeof vocab !== "object" || Array.isArray(vocab)) {
    issues.push(issue("vocabulary_required", "vocabulary is required", "vocabulary"));
  } else {
    const v = vocab as Record<string, unknown>;
    const registers = ["concrete", "everyday", "educated", "technical", "mixed"];
    if (typeof v.register !== "string" || !registers.includes(v.register)) {
      issues.push(
        issue(
          "vocabulary_register",
          `vocabulary.register must be one of: ${registers.join(", ")}`,
          "vocabulary.register",
        ),
      );
    }
    issues.push(...requireStringArray(v.markers, "vocabulary.markers", 1));
    if (!Array.isArray(v.avoids)) {
      issues.push(
        issue("vocabulary_avoids", "vocabulary.avoids must be an array", "vocabulary.avoids"),
      );
    }
  }

  issues.push(...requireStringArray(p.preferred_topics, "preferred_topics", 1));
  issues.push(...requireStringArray(p.avoidant_topics, "avoidant_topics", 1));

  const mem = p.memory_of_therapist;
  if (!mem || typeof mem !== "object" || Array.isArray(mem)) {
    issues.push(
      issue(
        "memory_of_therapist_required",
        "memory_of_therapist is required",
        "memory_of_therapist",
      ),
    );
  } else {
    const m = mem as Record<string, unknown>;
    if (typeof m.remembers_name !== "boolean") {
      issues.push(
        issue(
          "memory_remembers_name",
          "memory_of_therapist.remembers_name must be boolean",
          "memory_of_therapist.remembers_name",
        ),
      );
    }
    if (typeof m.remembers_prior_sessions !== "boolean") {
      issues.push(
        issue(
          "memory_remembers_prior",
          "memory_of_therapist.remembers_prior_sessions must be boolean",
          "memory_of_therapist.remembers_prior_sessions",
        ),
      );
    }
    if (!isTraitScale(m.alliance_sensitivity)) {
      issues.push(
        issue(
          "memory_alliance_sensitivity",
          `memory_of_therapist.alliance_sensitivity must be ${TRAIT_SCALE_MIN}–${TRAIT_SCALE_MAX}`,
          "memory_of_therapist.alliance_sensitivity",
        ),
      );
    }
    const ruptureErr = requireNonEmptyString(
      m.rupture_style,
      "memory_of_therapist.rupture_style",
      "memory_rupture_style",
    );
    if (ruptureErr) issues.push(ruptureErr);
    const notesErr = requireNonEmptyString(
      m.notes,
      "memory_of_therapist.notes",
      "memory_notes",
    );
    if (notesErr) issues.push(notesErr);
  }

  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, profile: raw as HumanPersonalityProfile };
}

/** True when value is a complete valid HumanPersonalityProfile. */
export function isHumanPersonalityProfile(
  value: unknown,
): value is HumanPersonalityProfile {
  return validateHumanPersonality(value).ok;
}
