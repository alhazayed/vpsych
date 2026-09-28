import { describe, expect, it } from "vitest";
import {
  summarizeGeneratedBundle,
  summarizeStructuredContext,
  truncateSummary,
} from "./humanize-guided";

describe("humanize-guided", () => {
  it("summarizes structured context without JSON", () => {
    const rows = summarizeStructuredContext({
      stressors: ["work", "family"],
      occupation: "Teacher",
      education: "BA",
    });
    expect(rows.some((r) => r.label === "Stressors" && r.value.includes("work"))).toBe(
      true,
    );
    expect(rows.some((r) => r.label === "Occupation")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('"stressors"');
  });

  it("summarizes generated bundle and omits empty fields", () => {
    const rows = summarizeGeneratedBundle({
      presentingComplaint: "Low mood for weeks",
      historyNarrative: "",
      displayNameEn: "Amina",
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        { label: "Display name (English)", value: "Amina" },
        { label: "Presenting complaint", value: "Low mood for weeks" },
      ]),
    );
    expect(rows.every((r) => r.value.length > 0)).toBe(true);
  });

  it("truncates long summary text", () => {
    expect(truncateSummary("a".repeat(300), 50).endsWith("…")).toBe(true);
  });
});
