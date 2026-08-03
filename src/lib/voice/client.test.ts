import { describe, expect, it } from "vitest";
import { ttsLeadInText } from "@/lib/voice/client";

describe("ttsLeadInText", () => {
  it("returns full text when under budget", () => {
    expect(ttsLeadInText("Short reply.", 180)).toEqual({
      lead: "Short reply.",
      rest: "",
    });
  });

  it("splits on sentence boundary for long replies", () => {
    const text =
      "I have been feeling heavy for months. Sleep is rough and work is slow every day now.";
    const { lead, rest } = ttsLeadInText(text, 50);
    expect(lead.endsWith(".")).toBe(true);
    expect(rest.length).toBeGreaterThan(0);
    expect(`${lead} ${rest}`.replace(/\s+/g, " ").trim()).toContain("Sleep is rough");
  });
});
