import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avatarToGuidedDraft,
  buildChangeReview,
  buildGuidedMergeWriteInput,
  detectArabicAuthorship,
  emptyGuidedDraft,
  findPresentationBySlug,
  isGuidedDraftDirty,
  listApprovedSaveFields,
  listChangedGuidedFields,
  markFieldApproved,
  markFieldAiSuggested,
  markFieldChanged,
  type GuidedCaseDraft,
  type GuidedChangeApprovals,
} from "@/lib/admin/case-builder";
import { isArabicPersonalityStub } from "@/lib/admin/virtual-patient/validation";
import { assessCaseReadinessFromAvatar } from "@/lib/admin/virtual-patient";
import { getBuiltinPersonality } from "@/lib/personality-engine";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";

const root = join(__dirname, "../../..");

function personality(
  locale: "en-US" | "ar-JO",
  name: string,
  opts?: { stub?: boolean },
): AvatarPersonality {
  const isAr = locale === "ar-JO";
  if (opts?.stub && isAr) {
    return {
      locale,
      language: "ar",
      direction: "rtl",
      authored_natively: true,
      never_translate: true,
      identity: {
        display_name: `${name} (مسودة عربية)`,
        city: "عمّان",
        country: "الأردن",
        occupation: "طالب",
      },
      persona_prompt:
        "أنت مريض تدريبي تخيلي للتعليم فقط — لست مريضاً حقيقياً.\nيجب على المؤلف إكمال الشخصية العربية بشكل مستقل قبل النشر (لا تنسخ الإنجليزية).",
      speech: { register: "colloquial", sample_utterances: ["صراحة تعبان"] },
      cultural_context: {
        stigma_framing: "الوصمة موجودة",
        help_seeking_attitude: "مترددة",
      },
      language_module: { directive: "تحدّثي باللهجة الأردنية" },
      safety_module: {
        crisis_resources: [{ name: "c", contact: "1" }],
        risk_disclosure_style: "cautious",
        boundary_rules: ["stay"],
      },
      voice: { stt_lang: "ar", tts_lang: "ar" },
    };
  }
  return {
    locale,
    language: isAr ? "ar" : "en",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: name,
      city: isAr ? "عمّان" : "Austin",
      country: isAr ? "الأردن" : "United States",
      occupation: isAr ? "مهندسة" : "Engineer",
      education: isAr ? "جامعي" : "University",
      living_situation: isAr ? "مع العائلة" : "with roommate",
      socioeconomic_context: isAr ? "حضري" : "urban",
    },
    persona_prompt: isAr
      ? "أنتِ مريضة في جلسة تدريب مؤلَّفة عربياً بشكل مستقل."
      : "You are a fictional training patient in an educational simulation.",
    speech: { register: "neutral", sample_utterances: ["hi"] },
    cultural_context: {
      stigma_framing: "x",
      help_seeking_attitude: "y",
    },
    language_module: { directive: "speak" },
    safety_module: {
      crisis_resources: [{ name: "c", contact: "1" }],
      risk_disclosure_style: "careful",
      boundary_rules: ["stay"],
    },
    voice: { stt_lang: isAr ? "ar" : "en", tts_lang: isAr ? "ar" : "en" },
  };
}

const RICH_GUIDELINES = {
  case_type: "training_simulation",
  primary_framework: "cbt",
  supporting_frameworks: ["motivational_interviewing"],
  session_goals: ["Build alliance", "Assess worry"],
  ideal_approach: "Primary training framework: cbt. Collaborative.",
  communication_style: "guarded",
  therapeutic_challenges: ["difficulty_establishing_rapport"],
  custom_educator_note: "preserve-me-10c2",
};

function makeAvatar(opts?: {
  arStub?: boolean;
  lifecycle?: string;
  missingAr?: boolean;
}): Avatar {
  const panic = findPresentationBySlug("panic-disorder");
  const core: ClinicalCore = {
    disorder: panic?.name ?? "Panic Disorder",
    dsm5_code: panic?.dsm5_code ?? undefined,
    icd11_code: panic?.icd11_code ?? undefined,
    age: 29,
    gender: "female",
    severity: "moderate",
    symptom_profile: [
      { id: "insomnia", description: "insomnia" },
      { id: "racing", description: "racing thoughts" },
    ],
    disclosure_rules: [{ topic: "panic", condition: "volunteered" }],
    session_goals: ["Build alliance", "Assess worry"],
    ideal_approach: "Primary training framework: cbt. Collaborative.",
    risk_profile: { suicidal_ideation: "none" },
    case_file: {
      consistency_rules: {
        principle: "preserve-case-file",
        canonical_facts_immutable: ["preserve-case-file"],
      },
    },
  };

  const ar = opts?.missingAr
    ? undefined
    : personality("ar-JO", "ليلى", { stub: opts?.arStub });

  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Lena Draft",
    disorder: core.disorder,
    age: core.age,
    gender: core.gender,
    portrait_url: null,
    persona_prompt: "You are a fictional training patient.",
    ideal_guidelines: RICH_GUIDELINES,
    rubric: [{ id: "alliance", label: "Alliance", weight: 1, max: 5 }],
    is_active: false,
    created_at: now,
    updated_at: now,
    slug: "lena-guided-edit",
    clinical_core: core,
    personalities: {
      "en-US": personality("en-US", "Lena Draft"),
      ...(ar ? { "ar-JO": ar } : {}),
    },
    human_personality: {
      "en-US": {
        ...getBuiltinPersonality("jordan-hale", "en-US")!,
        locale: "en-US",
        avatar_slug: "lena-guided-edit",
      },
      "ar-JO": {
        ...getBuiltinPersonality("jordan-hale", "ar-JO")!,
        locale: "ar-JO",
        avatar_slug: "lena-guided-edit",
      },
    },
    voice_profile_id: "voice-1",
    lifecycle_status: opts?.lifecycle ?? "draft",
    schema_version: 2,
  } as Avatar;
}

function personaFor(avatar: Avatar) {
  const panic = findPresentationBySlug("panic-disorder");
  return {
    default_disorder_id: panic?.id ?? null,
    default_disorder_slug: panic?.slug ?? null,
    display_name: avatar.name,
    slug: avatar.slug,
    identity: { age: 29, gender: "female" },
  };
}

describe("Phase 10C-2 A — Existing case → Guided load", () => {
  it("avatarToGuidedDraft maps persisted fields without inventing clinical content", () => {
    const avatar = makeAvatar({ arStub: true });
    const { draft, arabicAuthorship, presentationUnresolved } =
      avatarToGuidedDraft(avatar, personaFor(avatar));

    expect(draft.mode).toBe("edit");
    expect(draft.avatarId).toBe(avatar.id);
    expect(draft.profile.displayName).toBe("Lena Draft");
    expect(draft.symptoms.map((s) => s.description)).toEqual([
      "insomnia",
      "racing thoughts",
    ]);
    expect(draft.goals.map((g) => g.label)).toContain("Build alliance");
    expect(draft.primaryFramework).toBe("cbt");
    expect(draft.communicationStyle).toBe("guarded");
    expect(draft.therapeuticChallenges).toContain(
      "difficulty_establishing_rapport",
    );
    expect(draft.contextNarrative).toBe("");
    expect(arabicAuthorship).toBe("stub");
    expect(presentationUnresolved).toBe(false);
  });

  it("detectArabicAuthorship distinguishes missing / stub / authored", () => {
    expect(detectArabicAuthorship(makeAvatar({ missingAr: true }).personalities)).toBe(
      "missing",
    );
    expect(detectArabicAuthorship(makeAvatar({ arStub: true }).personalities)).toBe(
      "stub",
    );
    expect(detectArabicAuthorship(makeAvatar().personalities)).toBe("authored");
  });
});

describe("Phase 10C-2 B/C/D — merge only approved fields", () => {
  it("B no-op save → empty applied fields and no clinical payload", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft: structuredClone(baseline),
      approvals: {},
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.noop).toBe(true);
    expect(merge.appliedFields).toEqual([]);
    expect(merge.input.clinical_core).toBeUndefined();
    expect(merge.input.personalities).toBeUndefined();
    expect(merge.input.ideal_guidelines).toBeUndefined();
    expect(merge.input.human_personality).toBeUndefined();
  });

  it("C one-field edit → only symptoms in write input", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      symptoms: [
        ...baseline.symptoms,
        { id: "goal-dir", description: "increased goal-directed activity" },
      ],
    };
    const approvals: GuidedChangeApprovals = markFieldApproved(
      {},
      "symptoms",
      "administrator",
    );
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields).toEqual(["symptoms"]);
    expect(merge.input.clinical_core?.symptom_profile).toHaveLength(3);
    expect(merge.input.clinical_core?.session_goals).toEqual(
      avatar.clinical_core?.session_goals,
    );
    expect(merge.input.personalities).toBeUndefined();
    expect(merge.input.human_personality).toBeUndefined();
  });

  it("D multiple-field edit → only those fields change", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      profile: { ...baseline.profile, displayName: "Lena Revised", age: 31 },
      communicationStyle: "anxious",
    };
    let approvals = markFieldApproved({}, "profile", "administrator");
    approvals = markFieldApproved(approvals, "interaction", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields.sort()).toEqual(["interaction", "profile"].sort());
    expect(merge.input.clinical_core?.age).toBe(31);
    expect(merge.input.clinical_core?.symptom_profile).toEqual(
      avatar.clinical_core?.symptom_profile,
    );
    expect(
      (merge.input.ideal_guidelines as { communication_style?: string })
        .communication_style,
    ).toBe("anxious");
    expect(merge.input.personalities?.["en-US"]?.identity.display_name).toBe(
      "Lena Revised",
    );
  });
});

describe("Phase 10C-2 E/F/G/H/I — preservation", () => {
  it("E ideal_guidelines custom keys preserved on framework merge", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      primaryFramework: "motivational_interviewing",
      frameworkRationale: "Shift for training focus",
    };
    const approvals = markFieldApproved({}, "framework", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    const g = merge.input.ideal_guidelines as Record<string, unknown>;
    expect(g.custom_educator_note).toBe("preserve-me-10c2");
    expect(g.case_type).toBe("training_simulation");
    expect(g.primary_framework).toBe("motivational_interviewing");
  });

  it("F clinical_core case_file preserved when symptoms change", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      symptoms: [{ id: "x", description: "new only" }],
    };
    const approvals = markFieldApproved({}, "symptoms", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.input.clinical_core?.case_file).toEqual(
      avatar.clinical_core?.case_file,
    );
  });

  it("G human_personality omitted on guided merge (preserved by key absence)", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      profile: { ...baseline.profile, city: "Dallas" },
    };
    const approvals = markFieldApproved({}, "profile", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.input.human_personality).toBeUndefined();
  });

  it("H authored Arabic preserved byte-stable when English profile changes", () => {
    const avatar = makeAvatar();
    const arBefore = structuredClone(avatar.personalities!["ar-JO"]);
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      profile: { ...baseline.profile, displayName: "English Only Change" },
    };
    const approvals = markFieldApproved({}, "profile", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.input.personalities?.["ar-JO"]).toEqual(arBefore);
    expect(merge.input.personalities?.["en-US"]?.identity.display_name).toBe(
      "English Only Change",
    );
    expect(merge.arabicAuthorship).toBe("authored");
  });

  it("I Arabic stub preserved (still stub) after English edit", () => {
    const avatar = makeAvatar({ arStub: true });
    expect(isArabicPersonalityStub(avatar.personalities)).toBe(true);
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      profile: { ...baseline.profile, occupation: "Designer" },
    };
    const approvals = markFieldApproved({}, "profile", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(isArabicPersonalityStub(merge.input.personalities)).toBe(true);
    expect(merge.arabicAuthorship).toBe("stub");
  });
});

describe("Phase 10C-2 J/K — AI suggestion approve/reject", () => {
  it("J rejected AI suggestion → no change in approved save fields", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = structuredClone(baseline);
    // AI suggested but not applied to draft; reject clears approval
    const approvals = markFieldAiSuggested({}, "symptoms");
    expect(listApprovedSaveFields(baseline, draft, approvals)).toEqual([]);
    expect(isGuidedDraftDirty(baseline, draft)).toBe(false);
  });

  it("K approved AI suggestion → only that field in merge", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      symptoms: [
        ...baseline.symptoms,
        { id: "sleep-need", description: "reduced need for sleep" },
      ],
    };
    const approvals = markFieldApproved(
      {},
      "symptoms",
      "ai_suggestion_approved",
    );
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields).toEqual(["symptoms"]);
    expect(
      merge.input.clinical_core?.symptom_profile.some(
        (s) => s.description === "reduced need for sleep",
      ),
    ).toBe(true);
  });
});

describe("Phase 10C-2 L/M — lifecycle immutability (server helpers)", () => {
  it("L/M published and archived are not editable lifecycle", async () => {
    const { isEditableLifecycle, readLifecycleStatus } = await import(
      "@/lib/admin/virtual-patient"
    );
    expect(
      isEditableLifecycle(
        readLifecycleStatus(makeAvatar({ lifecycle: "published" })),
      ),
    ).toBe(false);
    expect(
      isEditableLifecycle(
        readLifecycleStatus(makeAvatar({ lifecycle: "archived" })),
      ),
    ).toBe(false);
    expect(
      isEditableLifecycle(
        readLifecycleStatus(makeAvatar({ lifecycle: "draft" })),
      ),
    ).toBe(true);
    expect(
      isEditableLifecycle(
        readLifecycleStatus(makeAvatar({ lifecycle: "testing" })),
      ),
    ).toBe(true);
  });
});

describe("Phase 10C-2 N — unsupported presentation rejected", () => {
  it("rejects unknown presentation id on merge", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      presentationId: "00000000-0000-4000-8000-000000000099",
      presentationSlug: "not-a-real-disorder",
      presentationName: "Fabricated",
    };
    const approvals = markFieldApproved({}, "presentation", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(false);
    if (merge.ok) return;
    expect(merge.code).toBe("presentation_unknown");
    expect(merge.status).toBe(400);
  });
});

describe("Phase 10C-2 O — readiness recalculation reuse", () => {
  it("assessCaseReadinessFromAvatar still runs after mapped load", () => {
    const avatar = makeAvatar({ arStub: true });
    const readiness = assessCaseReadinessFromAvatar(avatar, personaFor(avatar));
    expect(["COMPLETE", "WARNING", "BLOCKED"]).toContain(
      readiness.overallStatus,
    );
    expect(readiness.items.length).toBeGreaterThan(0);
  });
});

describe("Phase 10C-2 P — no duplicate avatar path", () => {
  it("merge input keeps existing slug and never sets create-only persona wipe", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      symptoms: [{ id: "a", description: "alone" }],
    };
    const approvals = markFieldApproved({}, "symptoms", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.input.slug).toBe(avatar.slug);
    expect(merge.input.rubric).toBeUndefined();
  });
});

describe("Phase 10C-2 Q — unsaved-change protection helpers", () => {
  it("detects dirty draft and builds review rows", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft = {
      ...structuredClone(baseline),
      profile: { ...baseline.profile, displayName: "Changed" },
    };
    expect(isGuidedDraftDirty(baseline, draft)).toBe(true);
    expect(listChangedGuidedFields(baseline, draft)).toEqual(["profile"]);
    const approvals = markFieldChanged({}, "profile");
    const rows = buildChangeReview(baseline, draft, approvals);
    const profile = rows.find((r) => r.field === "profile");
    expect(profile?.changed).toBe(true);
    expect(profile?.status).toBe("changed");
    const goals = rows.find((r) => r.field === "goals");
    expect(goals?.changed).toBe(false);
    expect(goals?.status).toBe("unchanged");
  });
});

describe("Phase 10C-2 hotfix — communication_style persistence contract", () => {
  it("maps communicationStyle → ideal_guidelines.communication_style on interaction merge", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    expect(baseline.communicationStyle).toBe("guarded");
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      communicationStyle: "anxious",
    };
    const approvals = markFieldApproved({}, "interaction", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields).toEqual(["interaction"]);
    const g = merge.input.ideal_guidelines as Record<string, unknown>;
    expect(g.communication_style).toBe("anxious");
    expect(g.session_goals).toEqual(avatar.ideal_guidelines?.session_goals);
    expect(g.ideal_approach).toBe(avatar.ideal_guidelines?.ideal_approach);
    expect(g.custom_educator_note).toBe("preserve-me-10c2");
    expect(g.case_type).toBe("training_simulation");
    expect(merge.input.clinical_core).toBeUndefined();
    expect(merge.input.personalities).toBeUndefined();
  });

  it("reload mapper returns communicationStyle from persisted guidelines", () => {
    const avatar = makeAvatar();
    const { draft } = avatarToGuidedDraft(avatar, personaFor(avatar));
    expect(draft.communicationStyle).toBe("guarded");
    expect(draft.therapeuticChallenges).toContain(
      "difficulty_establishing_rapport",
    );
  });

  it("symptom-only merge omits ideal_guidelines (style preserved by key absence)", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      symptoms: [
        ...baseline.symptoms,
        { id: "sx-only", description: "symptom only isolation" },
      ],
    };
    const approvals = markFieldApproved({}, "symptoms", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields).toEqual(["symptoms"]);
    expect(merge.input.ideal_guidelines).toBeUndefined();
    expect(merge.input.clinical_core?.session_goals).toEqual(
      avatar.clinical_core?.session_goals,
    );
  });

  it("goals-only merge updates goals without rewriting communication_style away", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      goals: [
        ...baseline.goals,
        {
          id: "goal-only",
          label: "Practice grounding (isolation)",
          category: "intervention",
          custom: true,
        },
      ],
    };
    const approvals = markFieldApproved({}, "goals", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.appliedFields).toEqual(["goals"]);
    const g = merge.input.ideal_guidelines as Record<string, unknown>;
    expect(g.communication_style).toBe("guarded");
    expect(g.custom_educator_note).toBe("preserve-me-10c2");
    expect(String(g.session_goals)).toContain("Practice grounding (isolation)");
  });

  it("interaction-only merge does not alter symptoms", () => {
    const avatar = makeAvatar();
    const baseline = avatarToGuidedDraft(avatar, personaFor(avatar)).draft;
    const draft: GuidedCaseDraft = {
      ...structuredClone(baseline),
      communicationStyle: "defensive",
    };
    const approvals = markFieldApproved({}, "interaction", "administrator");
    const merge = buildGuidedMergeWriteInput({
      existing: avatar,
      existingPersona: personaFor(avatar),
      baseline,
      draft,
      approvals,
    });
    expect(merge.ok).toBe(true);
    if (!merge.ok) return;
    expect(merge.input.clinical_core).toBeUndefined();
    expect(
      (merge.input.ideal_guidelines as { communication_style?: string })
        .communication_style,
    ).toBe("defensive");
  });

  it("trigger migration merges extras instead of wiping ideal_guidelines", () => {
    const sql = readFileSync(
      join(
        root,
        "../supabase/migrations/20260927092011_preserve_ideal_guidelines_extras.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/existing_guidelines/);
    expect(sql).toMatch(/existing_guidelines \|\| jsonb_build_object/);
    expect(sql).toMatch(/communication_style/);
    // Must not reintroduce the wipe-only assignment of only two keys.
    expect(sql).not.toMatch(
      /NEW\.ideal_guidelines := jsonb_build_object\(\s*'session_goals',\s*goals,\s*'ideal_approach',\s*approach\s*\)/,
    );
  });
});

describe("Phase 10C-2 R/S/T — wiring + security regression (source)", () => {
  it("case-builder [id] route uses requireApiAdmin, rate limit, mutability, audit", () => {
    const route = readFileSync(
      join(root, "app/api/admin/case-builder/[id]/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/rateLimit/);
    expect(route).toMatch(/assertAvatarContentMutable/);
    expect(route).toMatch(/updateVirtualPatientDraft/);
    expect(route).toMatch(/logSecurityEvent/);
    expect(route).toMatch(/buildGuidedMergeWriteInput/);
    expect(route).toMatch(/confirmReview/);
    expect(route).not.toMatch(/createVirtualPatientDraft/);
  });

  it("edit page mounts Guided Edit by default with Advanced switch", () => {
    const editPage = readFileSync(
      join(root, "app/(app)/admin/avatars/[id]/edit/page.tsx"),
      "utf8",
    );
    expect(editPage).toMatch(/EditPatientModeSwitch/);
    expect(editPage).toMatch(/avatarToGuidedDraft/);
    expect(editPage).toMatch(/isEditableLifecycle/);
    expect(editPage).toMatch(/requireAdmin/);
  });

  it("GuidedCaseBuilder has dirty beforeunload and editing banner", () => {
    const ui = readFileSync(
      join(root, "components/admin/case-builder/GuidedCaseBuilder.tsx"),
      "utf8",
    );
    expect(ui).toMatch(/beforeunload/);
    expect(ui).toMatch(/editingExistingBanner/);
    expect(ui).toMatch(/reviewChanges/);
    expect(ui).toMatch(/mode === \"edit\"|isEdit/);
  });

  it("empty create draft still defaults mode create", () => {
    expect(emptyGuidedDraft().mode).toBe("create");
  });
});
