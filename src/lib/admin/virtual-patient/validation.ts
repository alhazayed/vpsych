import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import { validateHumanPersonality } from "@/lib/personality-engine";
import { assessVirtualPatientCompleteness } from "@/lib/admin/virtual-patient-completeness";
import { isActiveVoiceProfile } from "@/lib/voice/registry";
import type { VoiceProfile } from "@/lib/types";

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
  gate?: string;
};

export type ValidationResult = {
  ok: boolean;
  publishReady: boolean;
  issues: ValidationIssue[];
  gates: Record<string, { ok: boolean; label: string }>;
};

export type VirtualPatientWriteInput = {
  slug?: string;
  default_locale?: string;
  clinical_core?: ClinicalCore | null;
  personalities?: Partial<Record<string, AvatarPersonality>> | null;
  human_personality?: Record<string, unknown> | null;
  rubric?: unknown;
  ideal_guidelines?: unknown;
  voice_profile_id?: string | null;
  voice_id?: string | null;
  voice_id_ar?: string | null;
  persona?: {
    create?: boolean;
    default_disorder_id?: string | null;
    default_disorder_slug?: string | null;
    display_name?: string;
    slug?: string;
    identity?: Record<string, unknown>;
    traits?: Record<string, unknown>;
  } | null;
};

function issue(
  code: string,
  message: string,
  opts?: { path?: string; severity?: "error" | "warning"; gate?: string },
): ValidationIssue {
  return {
    code,
    message,
    path: opts?.path,
    severity: opts?.severity ?? "error",
    gate: opts?.gate,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAuthoredPersonality(
  personalities: VirtualPatientWriteInput["personalities"],
  locale: string,
): boolean {
  const p = personalities?.[locale];
  if (!p || typeof p !== "object") return false;
  const identity = (p as AvatarPersonality).identity;
  const prompt = (p as AvatarPersonality).persona_prompt;
  return Boolean(
    identity &&
      isNonEmptyString(identity.display_name) &&
      isNonEmptyString(identity.city) &&
      isNonEmptyString(identity.country) &&
      isNonEmptyString(identity.occupation) &&
      isNonEmptyString(prompt),
  );
}

function validateClinicalCore(
  core: ClinicalCore | null | undefined,
  mode: "draft" | "publish",
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!core || typeof core !== "object") {
    if (mode === "publish") {
      out.push(
        issue("clinical_core_required", "clinical_core is required to publish", {
          path: "clinical_core",
          gate: "clinical",
        }),
      );
    }
    return out;
  }

  if (!isNonEmptyString(core.disorder)) {
    out.push(
      issue("clinical_disorder_required", "clinical_core.disorder is required", {
        path: "clinical_core.disorder",
        gate: "clinical",
        severity: mode === "publish" ? "error" : "warning",
      }),
    );
  }
  if (typeof core.age !== "number" || !Number.isFinite(core.age) || core.age < 1) {
    out.push(
      issue("clinical_age_required", "clinical_core.age must be a positive number", {
        path: "clinical_core.age",
        gate: "clinical",
        severity: mode === "publish" ? "error" : "warning",
      }),
    );
  }
  const genders = ["female", "male", "non-binary", "unspecified"];
  if (!isNonEmptyString(core.gender) || !genders.includes(core.gender)) {
    out.push(
      issue(
        "clinical_gender_required",
        `clinical_core.gender must be one of: ${genders.join(", ")}`,
        {
          path: "clinical_core.gender",
          gate: "clinical",
          severity: mode === "publish" ? "error" : "warning",
        },
      ),
    );
  }

  if (mode === "publish") {
    if (!Array.isArray(core.symptom_profile) || core.symptom_profile.length < 1) {
      out.push(
        issue(
          "clinical_symptoms_required",
          "clinical_core.symptom_profile needs at least one item",
          { path: "clinical_core.symptom_profile", gate: "clinical" },
        ),
      );
    }
    if (!Array.isArray(core.disclosure_rules) || core.disclosure_rules.length < 1) {
      out.push(
        issue(
          "clinical_disclosure_required",
          "clinical_core.disclosure_rules needs at least one item",
          { path: "clinical_core.disclosure_rules", gate: "clinical" },
        ),
      );
    }
    if (!Array.isArray(core.session_goals) || core.session_goals.length < 1) {
      out.push(
        issue(
          "clinical_goals_required",
          "clinical_core.session_goals needs at least one item",
          { path: "clinical_core.session_goals", gate: "clinical" },
        ),
      );
    }
    if (!isNonEmptyString(core.ideal_approach)) {
      out.push(
        issue(
          "clinical_approach_required",
          "clinical_core.ideal_approach is required",
          { path: "clinical_core.ideal_approach", gate: "clinical" },
        ),
      );
    }
    if (!core.risk_profile || typeof core.risk_profile !== "object") {
      out.push(
        issue("clinical_risk_required", "clinical_core.risk_profile is required", {
          path: "clinical_core.risk_profile",
          gate: "clinical",
        }),
      );
    } else if (
      !isNonEmptyString(core.risk_profile.suicidal_ideation) ||
      ![
        "none",
        "passive",
        "active_no_plan",
        "active_with_plan",
      ].includes(core.risk_profile.suicidal_ideation)
    ) {
      out.push(
        issue(
          "clinical_risk_si_required",
          "clinical_core.risk_profile.suicidal_ideation is required",
          { path: "clinical_core.risk_profile.suicidal_ideation", gate: "clinical" },
        ),
      );
    }
  }

  return out;
}

function validateLocalePersonality(
  personalities: VirtualPatientWriteInput["personalities"],
  locale: string,
  mode: "draft" | "publish",
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const present = hasAuthoredPersonality(personalities, locale);
  if (!present) {
    out.push(
      issue(
        `personality_${locale}_missing`,
        `${locale} personality must be independently authored (identity + persona_prompt)`,
        {
          path: `personalities.${locale}`,
          gate: locale === "ar-JO" ? "personality_ar" : "personality_en",
          severity: mode === "publish" ? "error" : "warning",
        },
      ),
    );
    return out;
  }

  const p = personalities![locale] as AvatarPersonality;
  if (p.authored_natively !== true || p.never_translate !== true) {
    out.push(
      issue(
        `personality_${locale}_native_flags`,
        `${locale} must set authored_natively and never_translate to true`,
        {
          path: `personalities.${locale}`,
          gate: locale === "ar-JO" ? "personality_ar" : "personality_en",
          severity: mode === "publish" ? "error" : "warning",
        },
      ),
    );
  }
  if (!isNonEmptyString(p.language)) {
    out.push(
      issue(`personality_${locale}_language`, `${locale}.language is required`, {
        path: `personalities.${locale}.language`,
        gate: locale === "ar-JO" ? "personality_ar" : "personality_en",
        severity: mode === "publish" ? "error" : "warning",
      }),
    );
  }
  return out;
}

function validateHumanLocale(
  map: Record<string, unknown> | null | undefined,
  locale: string,
  mode: "draft" | "publish",
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const gate = locale === "ar-JO" ? "human_personality_ar" : "human_personality_en";
  const raw = map?.[locale];
  if (raw == null) {
    out.push(
      issue(
        `human_personality_${locale}_missing`,
        `human_personality.${locale} is required to publish`,
        {
          path: `human_personality.${locale}`,
          gate,
          severity: mode === "publish" ? "error" : "warning",
        },
      ),
    );
    return out;
  }
  const validated = validateHumanPersonality(raw);
  if (!validated.ok) {
    for (const i of validated.issues) {
      out.push(
        issue(i.code, i.message, {
          path: i.path ? `human_personality.${locale}.${i.path}` : `human_personality.${locale}`,
          gate,
          severity: mode === "publish" ? "error" : "warning",
        }),
      );
    }
  }
  return out;
}

export function validateSlug(slug: unknown): ValidationIssue[] {
  if (!isNonEmptyString(slug)) {
    return [issue("slug_required", "slug is required", { path: "slug", gate: "identity" })];
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return [
      issue(
        "slug_format",
        "slug must be lowercase kebab-case (a-z, 0-9, hyphens)",
        { path: "slug", gate: "identity" },
      ),
    ];
  }
  if (slug.length > 80) {
    return [issue("slug_length", "slug must be ≤ 80 characters", { path: "slug", gate: "identity" })];
  }
  return [];
}

export type PublishContext = {
  voiceProfile?: VoiceProfile | null;
  defaultDisorderId?: string | null;
  defaultDisorderActive?: boolean;
};

/**
 * Validate a Virtual Patient write payload.
 * Draft mode allows incomplete bilingual / voice / disorder content.
 * Publish mode enforces the Phase 3A/3B publish gate.
 */
export function validateVirtualPatientWrite(
  input: VirtualPatientWriteInput,
  mode: "draft" | "publish",
  ctx: PublishContext = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];

  issues.push(...validateSlug(input.slug));

  const defaultLocale = input.default_locale ?? "en-US";
  if (!isNonEmptyString(defaultLocale)) {
    issues.push(
      issue("default_locale_required", "default_locale is required", {
        path: "default_locale",
        gate: "identity",
      }),
    );
  }

  issues.push(...validateClinicalCore(input.clinical_core, mode));
  issues.push(...validateLocalePersonality(input.personalities, "en-US", mode));
  issues.push(...validateLocalePersonality(input.personalities, "ar-JO", mode));
  issues.push(
    ...validateHumanLocale(
      input.human_personality as Record<string, unknown> | null,
      "en-US",
      mode,
    ),
  );
  issues.push(
    ...validateHumanLocale(
      input.human_personality as Record<string, unknown> | null,
      "ar-JO",
      mode,
    ),
  );

  const completeness = assessVirtualPatientCompleteness({
    human_personality: input.human_personality as Avatar["human_personality"],
    personalities: input.personalities as Avatar["personalities"],
    persona_prompt: input.personalities?.["en-US"]?.persona_prompt ?? "",
    voice_profile_id: input.voice_profile_id,
    voice_id: input.voice_id,
    voice_id_ar: input.voice_id_ar,
    clinical_core: input.clinical_core,
    disorder: input.clinical_core?.disorder ?? "",
  });

  if (mode === "publish") {
    if (!completeness.hasVoice) {
      issues.push(
        issue("voice_required", "Voice coverage is required to publish", {
          path: "voice_profile_id",
          gate: "voice",
        }),
      );
    } else if (input.voice_profile_id) {
      if (!ctx.voiceProfile) {
        issues.push(
          issue("voice_not_found", "Assigned voice profile was not found", {
            path: "voice_profile_id",
            gate: "voice",
          }),
        );
      } else if (!isActiveVoiceProfile(ctx.voiceProfile)) {
        issues.push(
          issue("voice_inactive", "Cannot publish with an inactive voice profile", {
            path: "voice_profile_id",
            gate: "voice",
          }),
        );
      }
    }

    const disorderOk =
      Boolean(ctx.defaultDisorderId) && ctx.defaultDisorderActive === true;
    if (!disorderOk) {
      issues.push(
        issue(
          "default_disorder_required",
          "An active default disorder catalog linkage is required to publish",
          { path: "persona.default_disorder_id", gate: "disorder" },
        ),
      );
    }

    // Guard against EN→AR silent copy for publish.
    const enPrompt = input.personalities?.["en-US"]?.persona_prompt?.trim();
    const arPrompt = input.personalities?.["ar-JO"]?.persona_prompt?.trim();
    if (enPrompt && arPrompt && enPrompt === arPrompt) {
      issues.push(
        issue(
          "personality_ar_not_independent",
          "Arabic persona_prompt must be independently authored (must not equal English)",
          { path: "personalities.ar-JO.persona_prompt", gate: "personality_ar" },
        ),
      );
    }
    const enName = input.personalities?.["en-US"]?.identity?.display_name?.trim();
    const arName = input.personalities?.["ar-JO"]?.identity?.display_name?.trim();
    if (enName && arName && enName === arName) {
      issues.push(
        issue(
          "personality_ar_name_not_independent",
          "Arabic display_name should be independently authored (must not equal English)",
          {
            path: "personalities.ar-JO.identity.display_name",
            gate: "personality_ar",
            severity: "warning",
          },
        ),
      );
    }
  } else if (!completeness.hasVoice) {
    issues.push(
      issue("voice_missing", "Voice not assigned yet", {
        path: "voice_profile_id",
        gate: "voice",
        severity: "warning",
      }),
    );
  }

  const errors = issues.filter((i) => i.severity === "error");
  const gates: ValidationResult["gates"] = {
    identity: {
      ok: !errors.some((i) => i.gate === "identity"),
      label: "Identity",
    },
    clinical: {
      ok: !errors.some((i) => i.gate === "clinical"),
      label: "Clinical profile",
    },
    personality_en: {
      ok: !errors.some((i) => i.gate === "personality_en"),
      label: "English personality",
    },
    personality_ar: {
      ok: !errors.some((i) => i.gate === "personality_ar"),
      label: "Arabic personality",
    },
    human_personality_en: {
      ok: !errors.some((i) => i.gate === "human_personality_en"),
      label: "Human personality — English",
    },
    human_personality_ar: {
      ok: !errors.some((i) => i.gate === "human_personality_ar"),
      label: "Human personality — Arabic",
    },
    voice: {
      ok: !errors.some((i) => i.gate === "voice"),
      label: "Voice",
    },
    disorder: {
      ok: !errors.some((i) => i.gate === "disorder"),
      label: "Default disorder",
    },
    runtime: {
      ok:
        mode === "publish"
          ? errors.length === 0
          : !errors.some((i) =>
              ["identity", "clinical"].includes(i.gate ?? ""),
            ),
      label: "Runtime configuration",
    },
  };

  const ok =
    mode === "draft"
      ? validateSlug(input.slug).length === 0
      : errors.length === 0;

  return {
    ok,
    publishReady: mode === "publish" ? errors.length === 0 : false,
    issues,
    gates,
  };
}

export function assessPublishReadiness(
  input: VirtualPatientWriteInput,
  ctx: PublishContext = {},
): ValidationResult {
  const result = validateVirtualPatientWrite(input, "publish", ctx);
  const publishReady =
    result.issues.filter((i) => i.severity === "error").length === 0;
  return {
    ...result,
    ok: publishReady,
    publishReady,
  };
}

export function assessDraftWrite(
  input: VirtualPatientWriteInput,
  ctx: PublishContext = {},
): ValidationResult {
  const draft = validateVirtualPatientWrite(input, "draft", ctx);
  const publish = assessPublishReadiness(input, ctx);
  return {
    ok: validateSlug(input.slug).length === 0,
    publishReady: publish.publishReady,
    issues: draft.issues,
    gates: publish.gates,
  };
}
