import { describe, expect, it } from "vitest";
import {
  ConversationController,
  InvalidConversationTransitionError,
  canTransition,
} from "@/lib/conversation/state-machine";

describe("ConversationController state machine", () => {
  it("allows the hands-free turn cycle", () => {
    const c = new ConversationController("Listening");
    expect(c.transition("Processing")).toBe("Processing");
    expect(c.transition("AvatarSpeaking")).toBe("AvatarSpeaking");
    expect(c.transition("Listening")).toBe("Listening");
  });

  it("supports interrupt path AvatarSpeaking → Processing", () => {
    const c = new ConversationController("Listening");
    c.transition("Processing");
    c.transition("AvatarSpeaking");
    expect(c.transition("Processing")).toBe("Processing");
  });

  it("rejects invalid transitions", () => {
    const c = new ConversationController("Listening");
    expect(() => c.transition("AvatarSpeaking")).toThrow(
      InvalidConversationTransitionError,
    );
    expect(canTransition("Finished", "Listening")).toBe(false);
    expect(c.tryTransition("AvatarSpeaking")).toBe(false);
    expect(c.getState()).toBe("Listening");
  });

  it("handles pause / resume / repeated pause without deadlock", () => {
    const c = new ConversationController("Listening");
    const t0 = 1_000_000;
    c.transition("Paused", t0);
    expect(c.isPaused()).toBe(true);
    expect(c.allowsMicrophone()).toBe(false);
    expect(c.allowsNetworkWork()).toBe(false);
    c.transition("Listening", t0 + 500);
    expect(c.pausedDurationMs(t0 + 500)).toBe(500);
    c.transition("Paused", t0 + 600);
    c.transition("Paused", t0 + 700); // no-op self transition allowed
    c.transition("Listening", t0 + 900);
    expect(c.pausedDurationMs(t0 + 900)).toBeGreaterThanOrEqual(800);
  });

  it("Finished is terminal", () => {
    const c = new ConversationController("Listening");
    c.transition("Finished");
    expect(c.tryTransition("Listening")).toBe(false);
    expect(c.transition("Finished")).toBe("Finished");
  });

  it("Processing can return to Listening on STT failure", () => {
    const c = new ConversationController("Listening");
    c.transition("Processing");
    expect(c.transition("Listening")).toBe("Listening");
  });
});
