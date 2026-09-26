/**
 * Phase 10B — server-authoritative Case Readiness.
 *
 * Consumes assessPublishReadiness / ValidationIssue gates. Does not invent a
 * second clinical validation engine. Publish authorization remains on the
 * persist/API path; this model is for educator UX only (never client authz).
 */

import type { Avatar } from "@/lib/types";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";
import { canTransitionLifecycle } from "@/lib/admin/virtual-patient-lifecycle";
import {
  assessPublishReadiness,
  isArabicPersonalityStub,
  type PublishContext,
  type ValidationIssue,
  type ValidationResult,
  type VirtualPatientWriteInput,
} from "./validation";
import { avatarToWriteInput, readLifecycleStatus } from "./persist";

export type ReadinessStatus = "COMPLETE" | "WARNING" | "BLOCKED";

export type ReadinessSectionId =
  | "clinical_presentation"
  | "patient_profile"
  | "symptoms"
  | "session_goals"
  | "therapeutic_framework"
  | "english_personality"
  | "arabic_personality"
  | "voice"
  | "preview"
  | "validation"
  | "safety";

export type ReadinessItem = {
  id: ReadinessSectionId;
  status: ReadinessStatus;
  label: string;
  explanation: string;
  /** Stable code for i18n / tests — never raw stack/DB detail. */
  code: string;
  remediation?: string;
  action?: {
    label: string;
    href?: string;
    focus?: string;
  };
};

export type CaseReadinessResult = {
  lifecycleStatus: VirtualPatientLifecycleStatus;
  schemaVersion: number;
  /** True only when publish gates pass AND lifecycle allows draft|testing → published. */
  readyToPublish: boolean;
  /** Authoritative ValidationResult.publishReady (ignores lifecycle). */
  publishGatesPassed: boolean;
  overallStatus: ReadinessStatus;
  summary: string;
  nextAction: string | null;
  items: ReadinessItem[];
  blockedCount: number;
  warningCount: number;
  /** Human-readable blocked reasons for Publish unavailable UI. */
  publishBlockers: string[];
  arabicAuthorship: "complete" | "stub" | "missing" | "incomplete";
  /** Echo of underlying validation for advanced diagnostics (safe codes only). */
  validation: Pick<ValidationResult, "publishReady" | "gates"> & {
    issueCodes: string[];
  };
};

export type AssessCaseReadinessOptions = {
  lifecycleStatus?: VirtualPatientLifecycleStatus;
  schemaVersion?: number;
  avatarId?: string | null;
};

const SECTION_LABELS: Record<ReadinessSectionId, string> = {
  clinical_presentation: "Clinical presentation",
  patient_profile: "Patient profile",
  symptoms: "Symptoms",
  session_goals: "Session goals",
  therapeutic_framework: "Therapeutic framework",
  english_personality: "English personality",
  arabic_personality: "Arabic personality",
  voice: "Voice",
  preview: "Preview validation",
  validation: "Validation",
  safety: "Safety & content",
};

function issuesFor(
  issues: ValidationIssue[],
  pred: (i: ValidationIssue) => boolean,
): ValidationIssue[] {
  return issues.filter(pred);
}

function statusFromIssues(matched: ValidationIssue[]): ReadinessStatus {
  if (matched.some((i) => i.severity === "error")) return "BLOCKED";
  if (matched.some((i) => i.severity === "warning")) return "WARNING";
  return "COMPLETE";
}

function primaryIssue(matched: ValidationIssue[]): ValidationIssue | undefined {
  return (
    matched.find((i) => i.severity === "error") ??
    matched.find((i) => i.severity === "warning")
  );
}

function detailHref(avatarId: string | null | undefined, focus: string): string | undefined {
  if (!avatarId) return undefined;
  return `/admin/avatars/${avatarId}?focus=${encodeURIComponent(focus)}`;
}

function item(
  id: ReadinessSectionId,
  status: ReadinessStatus,
  opts: {
    code: string;
    explanation: string;
    remediation?: string;
    actionLabel?: string;
    avatarId?: string | null;
    focus?: string;
  },
): ReadinessItem {
  const focus = opts.focus ?? id;
  return {
    id,
    status,
    label: SECTION_LABELS[id],
    explanation: opts.explanation,
    code: opts.code,
    remediation: opts.remediation,
    action:
      status === "COMPLETE"
        ? undefined
        : {
            label: opts.actionLabel ?? "Review this section",
            href: detailHref(opts.avatarId, focus),
            focus,
          },
  };
}

/**
 * Map authoritative publish validation into educator-facing readiness sections.
 */
export function assessCaseReadiness(
  input: VirtualPatientWriteInput,
  ctx: PublishContext = {},
  opts: AssessCaseReadinessOptions = {},
): CaseReadinessResult {
  const validation = assessPublishReadiness(input, ctx);
  const issues = validation.issues;
  const lifecycleStatus = opts.lifecycleStatus ?? "draft";
  const schemaVersion = opts.schemaVersion ?? 2;
  const avatarId = opts.avatarId ?? null;

  const core = input.clinical_core;
  const presentationIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_core_required" ||
      i.code === "clinical_disorder_required" ||
      i.code === "default_disorder_required" ||
      i.path === "clinical_core.disorder" ||
      i.path === "persona.default_disorder_id",
  );
  const profileIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_age_required" ||
      i.code === "clinical_gender_required" ||
      i.path === "clinical_core.age" ||
      i.path === "clinical_core.gender",
  );
  // Soft structural checks when publish validator has not yet emitted path-specific errors
  // (e.g. missing clinical_core entirely already covered by presentation).
  if (core && (typeof core.age !== "number" || core.age < 1)) {
    if (!profileIssues.some((i) => i.code === "clinical_age_required")) {
      profileIssues.push({
        code: "clinical_age_required",
        message: "Age is required",
        path: "clinical_core.age",
        severity: "error",
        gate: "clinical",
      });
    }
  }
  if (
    core &&
    (!core.gender ||
      !["female", "male", "non-binary", "unspecified"].includes(core.gender))
  ) {
    if (!profileIssues.some((i) => i.code === "clinical_gender_required")) {
      profileIssues.push({
        code: "clinical_gender_required",
        message: "Gender is required",
        path: "clinical_core.gender",
        severity: "error",
        gate: "clinical",
      });
    }
  }

  const symptomIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_symptoms_required" ||
      i.path === "clinical_core.symptom_profile",
  );
  const goalIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_goals_required" ||
      i.path === "clinical_core.session_goals",
  );
  const frameworkIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_approach_required" ||
      i.path === "clinical_core.ideal_approach",
  );
  const enIssues = issuesFor(
    issues,
    (i) =>
      i.gate === "personality_en" || i.gate === "human_personality_en",
  );
  const arIssues = issuesFor(
    issues,
    (i) =>
      i.gate === "personality_ar" || i.gate === "human_personality_ar",
  );
  const voiceIssues = issuesFor(issues, (i) => i.gate === "voice");
  const safetyIssues = issuesFor(
    issues,
    (i) =>
      i.code === "clinical_risk_required" ||
      i.code === "clinical_risk_si_required" ||
      i.code === "clinical_disclosure_required" ||
      (i.path?.startsWith("clinical_core.risk_profile") ?? false) ||
      i.path === "clinical_core.disclosure_rules",
  );
  const identityIssues = issuesFor(issues, (i) => i.gate === "identity");

  const arabicStub = isArabicPersonalityStub(input.personalities);
  const hasArPersonality = Boolean(input.personalities?.["ar-JO"]);
  let arabicAuthorship: CaseReadinessResult["arabicAuthorship"] = "complete";
  if (!hasArPersonality || arIssues.some((i) => i.code?.includes("missing"))) {
    arabicAuthorship = "missing";
  } else if (arabicStub || arIssues.some((i) => i.code === "personality_ar_stub")) {
    arabicAuthorship = "stub";
  } else if (statusFromIssues(arIssues) !== "COMPLETE") {
    arabicAuthorship = "incomplete";
  }

  const previewBlocked =
    schemaVersion < 2 ||
    Boolean(core == null) ||
    presentationIssues.some((i) => i.severity === "error") ||
    enIssues.some((i) => i.severity === "error");
  const previewWarnings =
    !previewBlocked &&
    (arIssues.some((i) => i.severity === "error") || schemaVersion < 2);

  const validationSectionIssues = [
    ...identityIssues,
    ...issuesFor(issues, (i) => i.gate === "disorder" || i.gate === "runtime"),
  ];
  if (schemaVersion < 2) {
    validationSectionIssues.push({
      code: "schema_version",
      message: "Case schema must be version 2 before publish",
      path: "schema_version",
      severity: "error",
      gate: "runtime",
    });
  }

  function explain(
    matched: ValidationIssue[],
    completeMsg: string,
    fallbackBlocked: string,
  ): { status: ReadinessStatus; code: string; explanation: string; remediation?: string } {
    const status = statusFromIssues(matched);
    if (status === "COMPLETE") {
      return { status, code: "ok", explanation: completeMsg };
    }
    const prim = primaryIssue(matched);
    const explanation =
      prim?.message && !/[A-Z_]{3,}/.test(prim.message)
        ? prim.message
        : fallbackBlocked;
    // Prefer educator wording over raw validator messages that look like paths.
    const educator =
      prim?.code === "clinical_symptoms_required"
        ? "At least one symptom is required."
        : prim?.code === "clinical_goals_required"
          ? "At least one session goal is required."
          : prim?.code === "clinical_approach_required"
            ? "A therapeutic approach / framework is required."
            : prim?.code === "clinical_disorder_required" ||
                prim?.code === "clinical_core_required"
              ? "A clinical presentation (diagnosis label) is required."
              : prim?.code === "default_disorder_required"
                ? "Link an active training presentation (default disorder)."
                : prim?.code === "clinical_age_required" ||
                    prim?.code === "clinical_gender_required"
                  ? "Age and gender are required for the patient profile."
                  : prim?.code === "personality_ar_stub"
                    ? "Arabic authoring is incomplete (draft stub)."
                    : prim?.code === "personality_ar_not_independent" ||
                        prim?.code === "personality_ar_name_not_independent"
                      ? "Arabic content must be independently authored — not copied from English."
                      : prim?.code?.startsWith("personality_en") ||
                          prim?.code?.startsWith("human_personality_en")
                        ? "English personality must include identity and persona prompt."
                        : prim?.code?.startsWith("personality_ar") ||
                            prim?.code?.startsWith("human_personality_ar")
                          ? "Arabic personality must be independently authored."
                          : prim?.code === "voice_required" ||
                              prim?.code === "voice_missing" ||
                              prim?.code === "voice_not_found" ||
                              prim?.code === "voice_inactive"
                            ? "An active voice profile is required."
                            : prim?.code === "clinical_risk_required" ||
                                prim?.code === "clinical_risk_si_required"
                              ? "Risk profile (including suicidal ideation level) is required."
                              : prim?.code === "clinical_disclosure_required"
                                ? "At least one disclosure rule is required."
                                : prim?.code === "schema_version"
                                  ? "Preview validation requires schema version 2."
                                  : explanation;

    return {
      status,
      code: prim?.code ?? "blocked",
      explanation: educator,
      remediation:
        status === "BLOCKED"
          ? "Complete this section, then re-check readiness."
          : "Review and strengthen this section before publish.",
    };
  }

  const presentation = explain(
    presentationIssues,
    "Clinical presentation is set.",
    "Clinical presentation is incomplete.",
  );
  const profile = explain(
    profileIssues.length
      ? profileIssues
      : !core
        ? [
            {
              code: "clinical_core_required",
              message: "Patient profile is missing",
              severity: "error" as const,
              gate: "clinical",
            },
          ]
        : [],
    "Age and gender are set.",
    "Patient profile is incomplete.",
  );
  const symptoms = explain(
    symptomIssues.length
      ? symptomIssues
      : core && (!Array.isArray(core.symptom_profile) || core.symptom_profile.length < 1)
        ? [
            {
              code: "clinical_symptoms_required",
              message: "Symptoms missing",
              severity: "error" as const,
              gate: "clinical",
            },
          ]
        : [],
    "Symptom profile includes at least one item.",
    "Symptoms are missing.",
  );
  const goals = explain(
    goalIssues.length
      ? goalIssues
      : core && (!Array.isArray(core.session_goals) || core.session_goals.length < 1)
        ? [
            {
              code: "clinical_goals_required",
              message: "Goals missing",
              severity: "error" as const,
              gate: "clinical",
            },
          ]
        : [],
    "Session goals are defined.",
    "Session goals are missing.",
  );
  const framework = explain(
    frameworkIssues.length
      ? frameworkIssues
      : core && !(typeof core.ideal_approach === "string" && core.ideal_approach.trim())
        ? [
            {
              code: "clinical_approach_required",
              message: "Framework missing",
              severity: "error" as const,
              gate: "clinical",
            },
          ]
        : [],
    "Therapeutic framework / ideal approach is set.",
    "Therapeutic framework is missing.",
  );
  const english = explain(
    enIssues,
    "English personality is independently authored.",
    "English personality is incomplete.",
  );
  let arabic = explain(
    arIssues,
    "Arabic personality is independently authored.",
    arabicStub
      ? "Arabic authoring is incomplete (draft stub)."
      : "Arabic personality is incomplete.",
  );
  if (arabicStub && arabic.status === "COMPLETE") {
    // Defensive: stub detector in validation should already block; keep UX honest.
    arabic = {
      status: "BLOCKED",
      code: "personality_ar_stub",
      explanation: "Arabic authoring is incomplete (draft stub).",
      remediation:
        "Author the Arabic patient independently before publish. English generation does not complete Arabic.",
    };
  }
  const voice = explain(
    voiceIssues,
    "An active voice profile is assigned.",
    "Voice is missing or inactive.",
  );
  const safety = explain(
    safetyIssues,
    "Risk profile and disclosure rules are set.",
    "Safety / content requirements are incomplete.",
  );

  const previewStatus: ReadinessStatus = previewBlocked
    ? "BLOCKED"
    : previewWarnings
      ? "WARNING"
      : "COMPLETE";
  const previewItem = item("preview", previewStatus, {
    code: schemaVersion < 2 ? "schema_version" : previewBlocked ? "preview_blocked" : "ok",
    explanation:
      schemaVersion < 2
        ? "Preview validation requires schema version 2."
        : previewBlocked
          ? "Preview cannot run until clinical presentation and English personality are complete."
          : arIssues.some((i) => i.severity === "error")
            ? "Preview can run for English; complete Arabic authoring for full bilingual preview."
            : "Case structure is ready for admin preview.",
    remediation:
      previewStatus === "COMPLETE"
        ? undefined
        : "Finish blocked sections, then use Preview on the patient detail page.",
    actionLabel: "Open preview",
    avatarId,
    focus: "preview",
  });

  const validationExplained = explain(
    validationSectionIssues,
    "Publish validation gates pass.",
    "Publish validation has not passed.",
  );

  const items: ReadinessItem[] = [
    item("clinical_presentation", presentation.status, {
      ...presentation,
      actionLabel: "Complete clinical presentation",
      avatarId,
      focus: "clinical",
    }),
    item("patient_profile", profile.status, {
      ...profile,
      actionLabel: "Complete patient profile",
      avatarId,
      focus: "clinical",
    }),
    item("symptoms", symptoms.status, {
      ...symptoms,
      actionLabel: "Add symptoms",
      avatarId,
      focus: "clinical",
    }),
    item("session_goals", goals.status, {
      ...goals,
      actionLabel: "Add session goals",
      avatarId,
      focus: "clinical",
    }),
    item("therapeutic_framework", framework.status, {
      ...framework,
      actionLabel: "Set therapeutic framework",
      avatarId,
      focus: "therapy",
    }),
    item("english_personality", english.status, {
      ...english,
      actionLabel: "Complete English personality",
      avatarId,
      focus: "personality",
    }),
    item("arabic_personality", arabic.status, {
      ...arabic,
      remediation:
        arabic.status === "COMPLETE"
          ? undefined
          : "Author Arabic independently. English AI generation does not complete Arabic.",
      actionLabel: "Complete Arabic authoring",
      avatarId,
      focus: "personality",
    }),
    item("voice", voice.status, {
      ...voice,
      actionLabel: "Assign voice",
      avatarId,
      focus: "voice",
    }),
    previewItem,
    item("validation", validationExplained.status, {
      ...validationExplained,
      actionLabel: "Review validation",
      avatarId,
      focus: "overview",
    }),
    item("safety", safety.status, {
      ...safety,
      actionLabel: "Complete safety requirements",
      avatarId,
      focus: "clinical",
    }),
  ];

  // Lifecycle overlays — do not change transition semantics, only messaging.
  if (lifecycleStatus === "archived") {
    for (const it of items) {
      if (it.status === "COMPLETE") continue;
      // Keep existing statuses; summary handles archived.
    }
  }

  const blockedCount = items.filter((i) => i.status === "BLOCKED").length;
  const warningCount = items.filter((i) => i.status === "WARNING").length;
  const publishGatesPassed =
    validation.publishReady &&
    schemaVersion >= 2 &&
    !arabicStub &&
    blockedCount === 0;

  const canPublishLifecycle = canTransitionLifecycle(lifecycleStatus, "published");
  const readyToPublish =
    publishGatesPassed &&
    canPublishLifecycle &&
    (lifecycleStatus === "draft" || lifecycleStatus === "testing");

  const publishBlockers: string[] = [];
  if (lifecycleStatus === "published") {
    publishBlockers.push("This virtual patient is already published.");
  } else if (lifecycleStatus === "archived") {
    publishBlockers.push("Restore from archive before publishing.");
  }
  for (const it of items) {
    if (it.status === "BLOCKED") {
      publishBlockers.push(it.explanation);
    }
  }

  let overallStatus: ReadinessStatus = "COMPLETE";
  if (blockedCount > 0) overallStatus = "BLOCKED";
  else if (warningCount > 0) overallStatus = "WARNING";

  if (lifecycleStatus === "published" && overallStatus === "COMPLETE") {
    // Published and still green.
  } else if (lifecycleStatus === "archived") {
    overallStatus = overallStatus === "COMPLETE" ? "WARNING" : overallStatus;
  }

  const firstBlocked = items.find((i) => i.status === "BLOCKED");
  const nextAction = readyToPublish
    ? "Ready to publish."
    : lifecycleStatus === "published"
      ? "Published — therapists can use this patient."
      : lifecycleStatus === "archived"
        ? "Restore to draft to continue authoring."
        : firstBlocked
          ? firstBlocked.remediation ?? firstBlocked.explanation
          : warningCount > 0
            ? "Review warnings, then publish when ready."
            : "Complete remaining requirements to continue.";

  const summary = readyToPublish
    ? "READY TO PUBLISH"
    : lifecycleStatus === "published"
      ? "PUBLISHED"
      : lifecycleStatus === "archived"
        ? "ARCHIVED"
        : "NOT READY TO PUBLISH";

  return {
    lifecycleStatus,
    schemaVersion,
    readyToPublish,
    publishGatesPassed,
    overallStatus,
    summary,
    nextAction,
    items,
    blockedCount,
    warningCount,
    publishBlockers,
    arabicAuthorship,
    validation: {
      publishReady: validation.publishReady,
      gates: validation.gates,
      issueCodes: issues.map((i) => i.code),
    },
  };
}

export function assessCaseReadinessFromAvatar(
  avatar: Avatar,
  persona: { default_disorder_id?: string | null } | null | undefined,
  ctx: PublishContext = {},
): CaseReadinessResult {
  const input = avatarToWriteInput(avatar, persona);
  const lifecycleStatus = readLifecycleStatus(avatar);
  return assessCaseReadiness(input, ctx, {
    lifecycleStatus,
    schemaVersion: avatar.schema_version ?? 1,
    avatarId: avatar.id,
  });
}
