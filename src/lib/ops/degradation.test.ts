import { beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { reportDegradation, reportFailure } from "@/lib/ops/degradation";

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

describe("reportFailure", () => {
  it("sends a tagged error with no message text", () => {
    reportFailure("case_memory_read_failed", { code: "57014", sessionId: undefined });
    expect(captureMessage).toHaveBeenCalledWith("failed: case_memory_read_failed", {
      level: "error",
      fingerprint: ["failed", "case_memory_read_failed", "57014"],
      tags: { failure: "case_memory_read_failed", code: "57014" },
    });
  });
});
