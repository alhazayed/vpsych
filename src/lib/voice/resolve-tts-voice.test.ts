import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("resolveTtsVoice security contract", () => {
  it("ignores client-supplied voiceId overrides in favor of avatar/profile", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/voice/resolve-tts-voice.ts"),
      "utf8",
    );
    expect(src).toMatch(/Never trust client-supplied ElevenLabs ids/);
    // Must not prefer client voiceId over DB (previous High regression).
    expect(src).not.toMatch(
      /legacyVoiceId\s*=\s*legacyVoiceId\s*\?\?\s*\(data\.voice_id/,
    );
    expect(src).not.toMatch(
      /legacyVoiceId\s*=\s*params\.voiceId\s*\?\?/,
    );
  });
});
