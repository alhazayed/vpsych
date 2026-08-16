import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Provider-aware extension of the `resolveTtsVoice` security control.
 *
 * The original invariant (a client cannot direct the server's provider
 * credentials at an arbitrary unapproved voice) must hold for Google exactly
 * as it does for ElevenLabs, and additionally must not leak voices across
 * providers: a registered ElevenLabs id is still unauthorized while Google is
 * the active provider, and vice versa.
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

const GOOGLE_EN = "en-US-Chirp3-HD-Kore";
const GOOGLE_OTHER = "en-US-Chirp3-HD-Puck";
const ELEVEN_ID = "EXAVITQu4vr4xnSDxMaL";

describe("resolveTtsVoice — Google provider", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("rejects an unregistered Google voice name and falls back to the default", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({ voice_profiles: [], avatars: [] }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      // Well-formed for Google, but not registered anywhere in the app.
      voiceId: "en-US-Chirp3-HD-Zephyr",
    });

    expect(result.voiceId).not.toBe("en-US-Chirp3-HD-Zephyr");
    expect(result.voiceId).toBe(GOOGLE_EN);
    expect(result.source).toBe("env_default");
  });

  it("accepts a Google voice registered in voice_profiles for that provider", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [{ voice_id: GOOGLE_OTHER, provider: "google" }],
        avatars: [],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      voiceId: GOOGLE_OTHER,
    });

    expect(result.voiceId).toBe(GOOGLE_OTHER);
    expect(result.source).toBe("legacy_column");
    expect(result.provider).toBe("google");
  });

  it("accepts a Google voice assigned on an avatar row", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [],
        avatars: [{ voice_id: GOOGLE_OTHER, voice_id_ar: null }],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      voiceId: GOOGLE_OTHER,
    });

    expect(result.voiceId).toBe(GOOGLE_OTHER);
  });

  it("does not let a registered ElevenLabs voice be used with Google", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        // Registered — but for the other provider.
        voice_profiles: [{ voice_id: ELEVEN_ID, provider: "elevenlabs" }],
        avatars: [{ voice_id: ELEVEN_ID, voice_id_ar: ELEVEN_ID }],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      voiceId: ELEVEN_ID,
    });

    expect(result.voiceId).not.toBe(ELEVEN_ID);
    expect(result.voiceId).toBe(GOOGLE_EN);
  });

  it("does not let a registered Google voice be used with ElevenLabs", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        voice_profiles: [{ voice_id: GOOGLE_OTHER, provider: "google" }],
        avatars: [{ voice_id: GOOGLE_OTHER, voice_id_ar: null }],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "elevenlabs",
      voiceId: GOOGLE_OTHER,
    });

    expect(result.voiceId).not.toBe(GOOGLE_OTHER);
    expect(result.source).toBe("env_default");
  });

  it("skips a cross-provider voice_profile assigned to the avatar", async () => {
    // The avatar's assigned profile is an active ElevenLabs profile, but the
    // active provider is Google — the profile must not win.
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        avatars: [
          {
            voice_profile_id: "p1",
            voice_id: null,
            voice_id_ar: null,
            voice_profile: {
              id: "p1",
              provider: "elevenlabs",
              voice_name: "Amira",
              voice_id: ELEVEN_ID,
              language: "en",
              dialect: null,
              gender: "female",
              is_active: true,
              created_at: "2026-07-31T00:00:00.000Z",
            },
          },
        ],
        voice_profiles: [],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      avatarId: "avatar-1",
    });

    expect(result.voiceId).toBe(GOOGLE_EN);
    expect(result.source).toBe("env_default");
  });

  it("uses a matching Google voice_profile assigned to the avatar", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({
        avatars: [
          {
            voice_profile_id: "p2",
            voice_id: null,
            voice_id_ar: null,
            voice_profile: {
              id: "p2",
              provider: "google",
              voice_name: "Amira (Chirp 3 HD)",
              voice_id: "ar-XA-Chirp3-HD-Kore",
              language: "ar",
              dialect: null,
              gender: "female",
              is_active: true,
              created_at: "2026-08-16T00:00:00.000Z",
            },
          },
        ],
        voice_profiles: [],
      }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "ar",
      provider: "google",
      avatarId: "avatar-2",
    });

    expect(result.voiceId).toBe("ar-XA-Chirp3-HD-Kore");
    expect(result.source).toBe("voice_profile");
    expect(result.voiceProfileId).toBe("p2");
  });

  it("still rejects a path-injecting value under Google", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseMock({ voice_profiles: [], avatars: [] }),
    );
    const { resolveTtsVoice } = await import("./resolve-tts-voice");

    const result = await resolveTtsVoice({
      locale: "en",
      provider: "google",
      voiceId: "../../v1/voices",
    });

    expect(result.voiceId).toBe(GOOGLE_EN);
  });
});
