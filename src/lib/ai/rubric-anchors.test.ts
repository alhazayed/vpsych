import { describe, expect, it } from "vitest";
import { DEFAULT_RUBRIC_LABELS_EN } from "@/lib/ai/report-locale";
import { formatRubricWithAnchors, hasOwnAnchors, rubricAnchors } from "@/lib/ai/rubric-anchors";

const ARABIC = /[؀-ۿ]/;
const LIVE_IDS = ["alliance", "assessment", "interventions", "safety", "structure"];

describe("rubric anchors", () => {
  it("covers the live 5-item rubric and every default rubric id in both languages", () => {
    for (const id of [...LIVE_IDS, ...Object.keys(DEFAULT_RUBRIC_LABELS_EN)]) {
      expect(hasOwnAnchors(id), id).toBe(true);
      const en = rubricAnchors(id, "en");
      const ar = rubricAnchors(id, "ar");
      expect(en).toHaveLength(6);
      expect(ar).toHaveLength(6);
      for (const a of ar) expect(a, `${id} ar`).toMatch(ARABIC);
      for (const a of en) expect(a, `${id} en`).not.toMatch(ARABIC);
      expect(new Set(en).size, `${id} en distinct`).toBe(6);
      expect(new Set(ar).size, `${id} ar distinct`).toBe(6);
    }
  });

  it("falls back to a generic scale for a custom rubric id", () => {
    expect(hasOwnAnchors("exploration")).toBe(false);
    expect(rubricAnchors("exploration", "en")).toHaveLength(6);
    expect(rubricAnchors("exploration", "ar")[0]).toMatch(ARABIC);
  });

  it("never names a diagnosis in an anchor", () => {
    const dx = /depress|anxiety disorder|ptsd|bipolar|schizo|اكتئاب|قلق عام|ثنائي القطب|فصام/i;
    for (const id of LIVE_IDS) {
      for (const a of [...rubricAnchors(id, "en"), ...rubricAnchors(id, "ar")]) {
        expect(a).not.toMatch(dx);
      }
    }
  });

  it("formats one block per item with its weight and six numbered anchors", () => {
    const block = formatRubricWithAnchors(
      [{ id: "alliance", label: "Alliance", weight: 25 }],
      "en",
    );
    expect(block.split("\n")[0]).toBe("alliance — Alliance (weight 25)");
    expect(block).toMatch(/\n {2}0: .+\n {2}1: .+\n {2}2: .+\n {2}3: .+\n {2}4: .+\n {2}5: .+$/);
    expect(formatRubricWithAnchors([{ id: "safety", label: "السلامة", weight: 20 }], "ar")).toContain(
      "safety — السلامة (الوزن 20)",
    );
  });
});
