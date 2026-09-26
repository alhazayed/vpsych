import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertAvatarContentMutable } from "@/lib/admin/virtual-patient/mutability";
import {
  buildRpcPayload,
  isEditableLifecycle,
  readLifecycleStatus,
  updateVirtualPatientDraft,
} from "@/lib/admin/virtual-patient/persist";
import { getBuiltinPersonality } from "@/lib/personality-engine";
import { saveHumanPersonalityProfile } from "@/lib/personality-engine/persist";
import type { AvatarPersonality, ClinicalCore } from "@/lib/types";

function personality(locale: "en-US" | "ar-JO", name: string): AvatarPersonality {
  const isAr = locale === "ar-JO";
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
      occupation: isAr ? "مهندس" : "Engineer",
    },
    persona_prompt: isAr
      ? "أنت مريض في جلسة تدريب مستقل التأليف."
      : "You are a patient in training.",
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
  primary_framework: "CBT",
  supporting_frameworks: ["MI"],
  session_goals: ["Build alliance", "Assess worry"],
  ideal_approach: "Collaborative CBT",
  communication_style: "guarded",
  therapeutic_challenges: ["difficulty_establishing_rapport"],
  custom_educator_note: "preserve-me",
};

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "edit-integrity-patient",
    default_locale: "en-US" as const,
    clinical_core: {
      disorder: "GAD",
      age: 34,
      gender: "female",
      symptom_profile: [
        { id: "worry", description: "Excessive worry" },
        { id: "sleep", description: "Insomnia" },
      ],
      disclosure_rules: [{ topic: "work", condition: "volunteered" }],
      session_goals: ["Build alliance", "Assess worry"],
      ideal_approach: "Collaborative CBT",
      risk_profile: { suicidal_ideation: "none" },
    } satisfies ClinicalCore,
    personalities: {
      "en-US": personality("en-US", "Sam"),
      "ar-JO": personality("ar-JO", "سامي"),
    },
    human_personality: {
      "en-US": {
        ...getBuiltinPersonality("jordan-hale", "en-US")!,
        locale: "en-US",
        avatar_slug: "edit-integrity-patient",
      },
      "ar-JO": {
        ...getBuiltinPersonality("jordan-hale", "ar-JO")!,
        locale: "ar-JO",
        avatar_slug: "edit-integrity-patient",
      },
    },
    rubric: [
      { id: "alliance", label: "Alliance", weight: 1, max: 5 },
      { id: "empathy", label: "Empathy", weight: 1, max: 5 },
    ],
    ideal_guidelines: RICH_GUIDELINES,
    voice_profile_id: "voice-1",
    persona: { create: true, default_disorder_id: "disorder-1" },
    ...overrides,
  };
}

function mockClient(handlers: {
  rpc?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: null | { message: string } }>;
  from?: (table: string) => unknown;
}) {
  return {
    rpc:
      handlers.rpc ??
      vi.fn(async () => ({ data: null, error: { message: "unexpected" } })),
    from: handlers.from ?? vi.fn(),
  } as never;
}

function avatarSelectFrom(row: Record<string, unknown>) {
  return vi.fn((table: string) => {
    if (table === "avatars") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      };
    }
    if (table === "voice_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "voice-1",
                provider: "elevenlabs",
                voice_name: "V",
                voice_id: "vid",
                language: "en",
                dialect: null,
                gender: "female",
                is_active: true,
                created_at: "2026-01-01",
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "disorders") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "disorder-1", is_active: true },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("Phase 10C-1 edit integrity — ideal_guidelines payload", () => {
  it("update omits ideal_guidelines when caller did not send them (no wipe)", () => {
    const payload = buildRpcPayload(
      {
        slug: "x",
        clinical_core: draftInput().clinical_core,
        personalities: draftInput().personalities,
        // intentionally no ideal_guidelines
      },
      { defaultDisorderId: null, defaultDisorderActive: false },
      "update",
    );
    expect(Object.prototype.hasOwnProperty.call(payload, "ideal_guidelines")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(payload, "human_personality")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(payload, "rubric")).toBe(false);
  });

  it("update preserves explicit ideal_guidelines when provided", () => {
    const payload = buildRpcPayload(
      {
        slug: "x",
        ideal_guidelines: RICH_GUIDELINES,
      },
      { defaultDisorderId: null, defaultDisorderActive: false },
      "update",
    );
    expect(payload.ideal_guidelines).toEqual(RICH_GUIDELINES);
  });

  it("create still defaults omitted ideal_guidelines to {}", () => {
    const payload = buildRpcPayload(
      { slug: "new-draft" },
      { defaultDisorderId: null, defaultDisorderActive: false },
      "create",
    );
    expect(payload.ideal_guidelines).toEqual({});
  });

  it("updateVirtualPatientDraft does not send empty ideal_guidelines for Advanced-style omit", async () => {
    const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      expect(fn).toBe("admin_update_virtual_patient");
      const payload = args.p_payload as Record<string, unknown>;
      expect(
        Object.prototype.hasOwnProperty.call(payload, "ideal_guidelines"),
      ).toBe(false);
      return {
        data: {
          avatar_id: "avatar-1",
          persona_id: null,
          slug: "edit-integrity-patient",
          lifecycle_status: "draft",
          is_active: false,
        },
        error: null,
      };
    });

    // Advanced wizard historically omitted ideal_guidelines — must not wipe.
    const { ideal_guidelines: _omit, ...withoutGuidelines } = draftInput();
    void _omit;

    const result = await updateVirtualPatientDraft(
      mockClient({
        rpc,
        from: avatarSelectFrom({
          id: "avatar-1",
          slug: "edit-integrity-patient",
          is_active: false,
          lifecycle_status: "draft",
          voice_profile_id: "voice-1",
          voice_profile: null,
        }),
      }),
      "avatar-1",
      withoutGuidelines,
    );
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("updateVirtualPatientDraft round-trips rich guidelines when provided", async () => {
    const rpc = vi.fn(async (_fn: string, args: Record<string, unknown>) => {
      const payload = args.p_payload as Record<string, unknown>;
      expect(payload.ideal_guidelines).toEqual(RICH_GUIDELINES);
      expect(payload.rubric).toEqual(draftInput().rubric);
      expect(payload.personalities).toEqual(draftInput().personalities);
      expect(payload.clinical_core).toEqual(draftInput().clinical_core);
      return {
        data: {
          avatar_id: "avatar-1",
          persona_id: null,
          slug: "edit-integrity-patient",
          lifecycle_status: "testing",
          is_active: false,
        },
        error: null,
      };
    });

    const result = await updateVirtualPatientDraft(
      mockClient({
        rpc,
        from: avatarSelectFrom({
          id: "avatar-1",
          slug: "edit-integrity-patient",
          is_active: false,
          lifecycle_status: "testing",
          voice_profile_id: "voice-1",
          voice_profile: null,
        }),
      }),
      "avatar-1",
      draftInput(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lifecycleStatus).toBe("testing");
  });
});

describe("Phase 10C-1 edit integrity — lifecycle mutability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("isEditableLifecycle: draft and testing only", () => {
    expect(isEditableLifecycle("draft")).toBe(true);
    expect(isEditableLifecycle("testing")).toBe(true);
    expect(isEditableLifecycle("published")).toBe(false);
    expect(isEditableLifecycle("archived")).toBe(false);
  });

  it("readLifecycleStatus falls back from is_active when column missing", () => {
    expect(readLifecycleStatus({ is_active: true })).toBe("published");
    expect(readLifecycleStatus({ is_active: false })).toBe("draft");
  });

  it("assertAvatarContentMutable allows draft and testing", async () => {
    for (const lifecycle_status of ["draft", "testing"] as const) {
      const result = await assertAvatarContentMutable(
        mockClient({
          from: avatarSelectFrom({
            id: "a1",
            lifecycle_status,
            is_active: false,
          }),
        }),
        "a1",
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.lifecycleStatus).toBe(lifecycle_status);
    }
  });

  it("assertAvatarContentMutable refuses published with 409", async () => {
    const result = await assertAvatarContentMutable(
      mockClient({
        from: avatarSelectFrom({
          id: "a1",
          lifecycle_status: "published",
          is_active: true,
        }),
      }),
      "a1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/immutable/i);
    }
  });

  it("assertAvatarContentMutable refuses archived with 409", async () => {
    const result = await assertAvatarContentMutable(
      mockClient({
        from: avatarSelectFrom({
          id: "a1",
          lifecycle_status: "archived",
          is_active: false,
        }),
      }),
      "a1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/restored/i);
    }
  });

  it("saveHumanPersonalityProfile refuses published (no silent mutate)", async () => {
    const updates: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === "avatars") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "a1",
                  lifecycle_status: "published",
                  is_active: true,
                  human_personality: {},
                },
                error: null,
              }),
            }),
          }),
          update: (patch: unknown) => {
            updates.push(patch);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      throw new Error(table);
    });

    const profile = getBuiltinPersonality("jordan-hale", "en-US")!;
    const result = await saveHumanPersonalityProfile(mockClient({ from }), {
      avatarId: "a1",
      locale: "en-US",
      profile: { ...profile, locale: "en-US", avatar_slug: "x" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/immutable/i);
    }
    expect(updates).toHaveLength(0);
  });
});

describe("Phase 10C-1 edit integrity — data preservation contract", () => {
  it("partial update payload does not replace unspecified clinical blobs", () => {
    const payload = buildRpcPayload(
      {
        slug: "partial",
        // only slug + voice — clinical/personalities/guidelines omitted
        voice_profile_id: "voice-2",
      },
      { defaultDisorderId: null, defaultDisorderActive: false },
      "update",
    );
    expect(payload.voice_profile_id).toBe("voice-2");
    expect(payload.clinical_core).toBeUndefined();
    expect(payload.personalities).toBeUndefined();
    expect(payload.human_personality).toBeUndefined();
    expect(payload.ideal_guidelines).toBeUndefined();
    expect(payload.rubric).toBeUndefined();
  });
});
