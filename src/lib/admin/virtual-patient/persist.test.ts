import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createVirtualPatientDraft,
  publishVirtualPatient,
  deactivateVirtualPatient,
  duplicateVirtualPatient,
  updateVirtualPatientDraft,
} from "@/lib/admin/virtual-patient/persist";
import { getBuiltinPersonality } from "@/lib/personality-engine";
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
      country: isAr ? "Jordan" : "United States",
      occupation: isAr ? "مهندس" : "Engineer",
    },
    persona_prompt: isAr
      ? "أنت مريض في جلسة تدريب."
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

function fullInput() {
  return {
    slug: "lifecycle-patient",
    default_locale: "en-US" as const,
    clinical_core: {
      disorder: "GAD",
      age: 34,
      gender: "non-binary",
      symptom_profile: [{ id: "worry", description: "Worry" }],
      disclosure_rules: [{ topic: "work", condition: "volunteered" }],
      session_goals: ["Alliance"],
      ideal_approach: "Supportive",
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
        avatar_slug: "lifecycle-patient",
      },
      "ar-JO": {
        ...getBuiltinPersonality("jordan-hale", "ar-JO")!,
        locale: "ar-JO",
        avatar_slug: "lifecycle-patient",
      },
    },
    voice_profile_id: "voice-1",
    persona: { create: true, default_disorder_id: "disorder-1" },
  };
}

function mockClient(handlers: {
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null | { message: string } }>;
  from?: (table: string) => unknown;
}) {
  return {
    rpc: handlers.rpc ?? vi.fn(async () => ({ data: null, error: { message: "unexpected" } })),
    from: handlers.from ?? vi.fn(),
  } as never;
}

describe("virtual patient persist lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("admin create draft always persists is_active false via RPC", async () => {
    const rpc = vi.fn(async (_fn: string, args: Record<string, unknown>) => {
      expect(_fn).toBe("admin_create_virtual_patient");
      const payload = args.p_payload as Record<string, unknown>;
      expect(payload.slug).toBe("lifecycle-patient");
      // RPC forces inactive — payload must not request active
      expect(payload.is_active).toBeUndefined();
      return {
        data: {
          avatar_id: "avatar-1",
          persona_id: "persona-1",
          slug: "lifecycle-patient",
          is_active: false,
        },
        error: null,
      };
    });

    const from = vi.fn((table: string) => {
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

    const result = await createVirtualPatientDraft(mockClient({ rpc, from }), fullInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isActive).toBe(false);
      expect(result.avatarId).toBe("avatar-1");
      expect(result.personaId).toBe("persona-1");
    }
  });

  it("rejects create when slug invalid (no RPC call)", async () => {
    const rpc = vi.fn();
    const result = await createVirtualPatientDraft(mockClient({ rpc }), {
      slug: "BAD SLUG",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("publish activates only after gates pass", async () => {
    const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
    const from = vi.fn((table: string) => {
      if (table === "avatars") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "avatar-1",
                  slug: "lifecycle-patient",
                  is_active: false,
                  schema_version: 2,
                  default_locale: "en-US",
                  clinical_core: fullInput().clinical_core,
                  personalities: fullInput().personalities,
                  human_personality: fullInput().human_personality,
                  rubric: [],
                  ideal_guidelines: {},
                  voice_profile_id: "voice-1",
                  voice_id: "vid",
                  voice_id_ar: null,
                  voice_profile: {
                    id: "voice-1",
                    provider: "elevenlabs",
                    voice_name: "V",
                    voice_id: "vid",
                    language: "en",
                    dialect: null,
                    gender: null,
                    is_active: true,
                    created_at: "2026-01-01",
                  },
                },
                error: null,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            updates.push({ table, patch });
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      if (table === "personas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "persona-1", default_disorder_id: "disorder-1" },
                error: null,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            updates.push({ table, patch });
            return {
              eq: async () => ({ error: null }),
            };
          },
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
      throw new Error(table);
    });

    const result = await publishVirtualPatient(mockClient({ from }), "avatar-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(true);
    expect(updates.some((u) => u.table === "avatars" && u.patch.is_active === true)).toBe(
      true,
    );
  });

  it("publish fails without EN personality and does not activate", async () => {
    const updates: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === "avatars") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "avatar-1",
                  slug: "x",
                  is_active: false,
                  schema_version: 2,
                  default_locale: "en-US",
                  clinical_core: fullInput().clinical_core,
                  personalities: { "ar-JO": personality("ar-JO", "س") },
                  human_personality: fullInput().human_personality,
                  rubric: [],
                  ideal_guidelines: {},
                  voice_profile_id: "voice-1",
                  voice_id: "vid",
                  voice_id_ar: null,
                  voice_profile: {
                    id: "voice-1",
                    provider: "elevenlabs",
                    voice_name: "V",
                    voice_id: "vid",
                    language: "en",
                    dialect: null,
                    gender: null,
                    is_active: true,
                    created_at: "2026-01-01",
                  },
                },
                error: null,
              }),
            }),
          }),
          update: () => {
            updates.push("update");
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "personas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "p1", default_disorder_id: "disorder-1" },
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
      throw new Error(table);
    });

    const result = await publishVirtualPatient(mockClient({ from }), "avatar-1");
    expect(result.ok).toBe(false);
    expect(updates.length).toBe(0);
  });

  it("deactivate sets is_active false without deleting sessions", async () => {
    const from = vi.fn((table: string) => {
      if (table === "avatars") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "avatar-1", slug: "x", is_active: true },
                error: null,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            expect(patch.is_active).toBe(false);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "personas") {
        return {
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      // sessions / reports must never be touched
      throw new Error(`unexpected table ${table}`);
    });

    const result = await deactivateVirtualPatient(mockClient({ from }), "avatar-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(false);
  });

  it("duplicate creates new inactive id via RPC and does not copy sessions", async () => {
    const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      expect(fn).toBe("admin_duplicate_virtual_patient");
      expect(args.p_source_avatar_id).toBe("source-1");
      expect(args.p_new_slug).toBe("source-1-copy");
      return {
        data: {
          avatar_id: "new-1",
          persona_id: "new-p",
          slug: "source-1-copy",
          is_active: false,
        },
        error: null,
      };
    });
    const result = await duplicateVirtualPatient(
      mockClient({ rpc }),
      "source-1",
      "source-1-copy",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.avatarId).toBe("new-1");
      expect(result.isActive).toBe(false);
      expect(result.avatarId).not.toBe("source-1");
    }
  });

  it("update refuses published avatar (requires deactivate first)", async () => {
    const from = vi.fn((table: string) => {
      if (table === "avatars") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "avatar-1",
                  slug: "published",
                  is_active: true,
                  voice_profile_id: null,
                  voice_profile: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(table);
    });
    const result = await updateVirtualPatientDraft(mockClient({ from }), "avatar-1", {
      slug: "published",
      clinical_core: fullInput().clinical_core,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("surfaces slug conflict from RPC as 409", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Slug already exists" },
    }));
    const from = vi.fn((table: string) => {
      if (table === "voice_profiles" || table === "disorders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(table);
    });
    const result = await createVirtualPatientDraft(mockClient({ rpc, from }), {
      slug: "taken-slug",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });
});
