import { describe, expect, it } from "vitest";
import { isAssistantPersistTipCurrent } from "@/lib/voice/stale-assistant-guard";

describe("isAssistantPersistTipCurrent (Phase 9.1R / Fix 4)", () => {
  it("Test G — late stale turn must not persist when tip moved", () => {
    const turnNUserId = "user-n";
    // Turn N+1 already inserted a newer user message
    expect(
      isAssistantPersistTipCurrent({
        expectedUserMessageId: turnNUserId,
        tip: { id: "user-n-plus-1", role: "user" },
      }),
    ).toBe(false);
  });

  it("allows persist when this request's user message is still the tip", () => {
    expect(
      isAssistantPersistTipCurrent({
        expectedUserMessageId: "user-n",
        tip: { id: "user-n", role: "user" },
      }),
    ).toBe(true);
  });

  it("rejects when tip is already an assistant (another turn won the race)", () => {
    expect(
      isAssistantPersistTipCurrent({
        expectedUserMessageId: "user-n",
        tip: { id: "asst-other", role: "assistant" },
      }),
    ).toBe(false);
  });

  it("rejects null tip", () => {
    expect(
      isAssistantPersistTipCurrent({
        expectedUserMessageId: "user-n",
        tip: null,
      }),
    ).toBe(false);
  });
});
