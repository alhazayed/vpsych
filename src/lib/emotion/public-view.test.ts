import { describe, expect, it } from "vitest";
import { initEmotionState } from "@/lib/emotion";
import { publicEmotionState } from "@/lib/emotion/public-view";

describe("publicEmotionState", () => {
  it("drops the diagnosis and keeps the rest of the state", () => {
    const state = initEmotionState({
      sessionId: "s1",
      disorderSlug: "major-depressive-disorder",
    });
    expect(state.disorder_slug).toBe("major-depressive-disorder");

    const view = publicEmotionState(state);
    expect(view).not.toHaveProperty("disorder_slug");
    expect(JSON.stringify(view)).not.toContain("major-depressive-disorder");
    expect(view.mode).toBe(state.mode);
    expect(view.variables).toEqual(state.variables);
  });
});
