import { describe, expect, it } from "vitest";
import { PATIENT_HISTORY_LIMIT, takeRecentMessages } from "@/lib/session-messages";

describe("takeRecentMessages", () => {
  it("returns the input when under the limit", () => {
    const msgs = [{ id: 1 }, { id: 2 }];
    expect(takeRecentMessages(msgs, 40)).toEqual(msgs);
  });

  it("keeps only the newest N messages in order", () => {
    const msgs = Array.from({ length: 55 }, (_, i) => ({ id: i + 1 }));
    const recent = takeRecentMessages(msgs, 40);
    expect(recent).toHaveLength(40);
    expect(recent[0]?.id).toBe(16);
    expect(recent.at(-1)?.id).toBe(55);
  });

  it("defaults to PATIENT_HISTORY_LIMIT", () => {
    expect(PATIENT_HISTORY_LIMIT).toBe(40);
    const msgs = Array.from({ length: 100 }, (_, i) => i);
    expect(takeRecentMessages(msgs)).toHaveLength(40);
  });
});
