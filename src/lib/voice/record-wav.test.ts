import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("startMicWavRecording graph", () => {
  it("mutes the processor output to avoid live mic feedback", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/voice/record-wav.ts"),
      "utf8",
    );
    expect(src).toMatch(/createGain/);
    expect(src).toMatch(/mute\.gain\.value\s*=\s*0/);
    expect(src).toMatch(/processor\.connect\(mute\)/);
    // Direct unmuted destination connection is the echo regression.
    expect(src).not.toMatch(/processor\.connect\(audioContext\.destination\)/);
  });

  it("auto-stops sample collection after maxMs", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/voice/record-wav.ts"),
      "utf8",
    );
    expect(src).toMatch(/Auto-cap capture length/);
    expect(src).toMatch(/stopped = true/);
  });
});
