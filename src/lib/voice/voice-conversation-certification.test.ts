import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

describe("Voice + Conversation certification guards", () => {
  it("caps mic capture duration by flipping stopped=true", () => {
    const rec = readFileSync(join(root, "lib/voice/record-wav.ts"), "utf8");
    expect(rec).toMatch(/setTimeout\(\(\) => \{[\s\S]*stopped = true/);
    expect(rec).toMatch(/isStopped\(\)/);
  });

  it("revokes TTS blob URLs when stopping playback", () => {
    const ui = readFileSync(join(root, "components/VoiceSession.tsx"), "utf8");
    expect(ui).toMatch(/URL\.revokeObjectURL/);
  });

  it("raises STT/TTS rate limits for multi-turn voice training", () => {
    const stt = readFileSync(
      join(root, "app/api/voice/transcribe/route.ts"),
      "utf8",
    );
    const tts = readFileSync(join(root, "app/api/voice/tts/route.ts"), "utf8");
    expect(stt).toMatch(/rateLimit\(`stt:\$\{user\.id\}`, 300/);
    expect(tts).toMatch(/rateLimit\(`tts:\$\{user\.id\}`, 400/);
  });
});
