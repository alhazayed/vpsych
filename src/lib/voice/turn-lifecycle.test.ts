import { describe, expect, it } from "vitest";
import { createVoiceTurnFence } from "@/lib/voice/turn-fence";
import {
  clearVoiceTurnPending,
  shouldApplyVoiceTurnResult,
  therapistTurnStartAction,
} from "@/lib/voice/turn-lifecycle";

describe("turn lifecycle cleanup vs apply (Phase 9.1R)", () => {
  it("Test A — session end + fence invalidation still clears pending", async () => {
    const fence = createVoiceTurnFence();
    let pending = false;
    const setPending = (v: boolean) => {
      pending = v;
    };

    const turnId = fence.beginTurn();
    setPending(true);

    // session timer → endSession invalidates fence; end request fails
    fence.invalidate();
    const endFailed = true;
    expect(endFailed).toBe(true);

    // turn finally executes
    const apply = shouldApplyVoiceTurnResult({
      turnId,
      isActive: (id) => fence.isActive(id),
    });
    expect(apply).toBe(false); // no stale content
    clearVoiceTurnPending(setPending); // cleanup always
    expect(pending).toBe(false);
  });

  it("Test F — late stale turn cannot apply voice state", () => {
    const fence = createVoiceTurnFence();
    const oldTurn = fence.beginTurn();
    fence.beginTurn();
    expect(
      shouldApplyVoiceTurnResult({
        turnId: oldTurn,
        isActive: (id) => fence.isActive(id),
      }),
    ).toBe(false);
  });

  it("active turn may still apply results", () => {
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    expect(
      shouldApplyVoiceTurnResult({
        turnId,
        isActive: (id) => fence.isActive(id),
      }),
    ).toBe(true);
  });
});

describe("therapistTurnStartAction — no patient speech over the therapist", () => {
  it("audible patient audio is an interruption", () => {
    expect(
      therapistTurnStartAction({ patientAudible: true, patientAudioScheduled: true }),
    ).toBe("interrupt");
  });

  it("a reply still synthesizing is cancelled without the interruption flag", () => {
    expect(
      therapistTurnStartAction({ patientAudible: false, patientAudioScheduled: true }),
    ).toBe("cancel_scheduled");
  });

  it("nothing pending → nothing to do", () => {
    expect(
      therapistTurnStartAction({ patientAudible: false, patientAudioScheduled: false }),
    ).toBe("none");
  });
});
