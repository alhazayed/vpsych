import { describe, expect, it } from "vitest";
import {
  canSubmitTranscript,
  createPendingTurnGuard,
  markTurnFailed,
  markTurnInFlight,
  markTurnSucceeded,
  turnDedupKey,
} from "@/lib/conversation/recovery";

describe("network recovery dedup", () => {
  it("normalizes mixed-language whitespace for dedup keys", () => {
    expect(turnDedupKey("  Hello   مرحبا  ")).toBe("hello مرحبا");
  });

  it("blocks duplicate submit after success (reconnect)", () => {
    let g = createPendingTurnGuard();
    const text = "How have you been sleeping?";
    expect(canSubmitTranscript(g, text)).toBe(true);
    g = markTurnInFlight(g, text);
    expect(canSubmitTranscript(g, text)).toBe(false);
    g = markTurnSucceeded(g, text);
    expect(canSubmitTranscript(g, text)).toBe(false);
    expect(canSubmitTranscript(g, "And your appetite?")).toBe(true);
  });

  it("allows retry after failure", () => {
    let g = createPendingTurnGuard();
    const text = "Tell me more";
    g = markTurnInFlight(g, text);
    g = markTurnFailed(g);
    expect(canSubmitTranscript(g, text)).toBe(true);
  });

  it("handles Arabic transcript dedup", () => {
    let g = createPendingTurnGuard();
    const text = "كيف نومك؟";
    g = markTurnSucceeded(g, text);
    expect(canSubmitTranscript(g, "كيف نومك؟")).toBe(false);
    expect(canSubmitTranscript(g, "كيف  نومك؟")).toBe(false);
  });
});
