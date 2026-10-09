import { beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { reportDegradation } from "@/lib/ops/degradation";

beforeEach(() => captureMessage.mockReset());

describe("reportDegradation", () => {
  it("sends a tagged warning grouped per event and code", () => {
    reportDegradation("tts_provider_failed", { code: "TTS_AUTH", empty: null });
    expect(captureMessage).toHaveBeenCalledWith("degraded: tts_provider_failed", {
      level: "warning",
      fingerprint: ["degraded", "tts_provider_failed", "TTS_AUTH"],
      tags: { degradation: "tts_provider_failed", code: "TTS_AUTH" },
    });
  });
});
