import { describe, expect, it } from "vitest";
import { createMicClaim } from "@/lib/voice/mic-claim";

describe("createMicClaim (Phase 9.1R)", () => {
  it("Test B — second claim before first release is rejected", () => {
    const claim = createMicClaim();
    expect(claim.tryClaim()).toBe(true);
    expect(claim.isClaimed()).toBe(true);
    expect(claim.tryClaim()).toBe(false);
    claim.release();
    expect(claim.isClaimed()).toBe(false);
    expect(claim.tryClaim()).toBe(true);
  });

  it("simulates double listen trigger before startMicWavRecording resolves", async () => {
    const claim = createMicClaim();
    let acquisitions = 0;
    const startMic = async () => {
      if (!claim.tryClaim()) return null;
      acquisitions += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { id: acquisitions };
    };

    const [a, b] = await Promise.all([startMic(), startMic()]);
    expect(acquisitions).toBe(1);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    claim.release();
  });
});
