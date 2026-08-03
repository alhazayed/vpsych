import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for a verified vulnerability: /api/voice/tts previously
 * passed client-supplied `voiceId` / `voiceIdAr` straight through to the
 * ElevenLabs API with no server-side validation, letting any authenticated
 * user direct synthesis (and the org's ElevenLabs spend) at an arbitrary,
 * unapproved voice. resolveTtsVoice must only honor values that already
 * exist in the app's voice configuration (voice_profiles or avatars).
 */

type TableName = "avatars" | "voice_profiles";

function makeSupabaseMock(tables: Partial<Record<TableName, unknown[]>>) {
  return {
    from(table: TableName) {
      const rows = tables[table] ?? [];
      const api = {
        select: () => api,
        eq: () => api,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      };
      return api;
    },
  };
}

const createClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

describe("resolveTtsVoice", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("ignores a client-supplied voiceId that is not in the registry or any avatar", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [{ voice_id: "registered-voice-1" }],
        avatars: [{ voice_id: "avatar-voice-1", voice_id_ar: null }],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      voiceId: "attacker-controlled-arbitrary-voice-id",
    });

    expect(result.voiceId).not.toBe(
      "attacker-controlled-arbitrary-voice-id",
    );
    expect(result.source).toBe("env_default");
  });

  it("honors a client-supplied voiceId that matches a registered voice_profiles row", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [{ voice_id: "registered-voice-1" }],
        avatars: [],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      voiceId: "registered-voice-1",
    });

    expect(result.voiceId).toBe("registered-voice-1");
    expect(result.source).toBe("legacy_column");
  });

  it("honors a voiceId matching an existing avatar's own voice column", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [],
        avatars: [{ voice_id: "avatar-voice-1", voice_id_ar: null }],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      voiceId: "avatar-voice-1",
    });

    expect(result.voiceId).toBe("avatar-voice-1");
  });

  it("still falls back to env defaults when nothing is supplied", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({ voice_profiles: [], avatars: [] }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({ locale: "en" });

    expect(result.voiceId).toBeTruthy();
    expect(result.source).toBe("env_default");
  });
});
