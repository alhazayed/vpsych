import { describe, expect, it } from "vitest";
import { buildSkillProgress, type ProgressSessionInput } from "@/lib/skill-progress";

function report(
  overall: number,
  items: Array<[string, number]>,
  mode: string = "llm_examiner",
) {
  return {
    scores: {
      overall,
      items: items.map(([id, score]) => ({ id, label: id, score, max: 5, weight: 1, feedback: "" })),
      scientific_provenance: { assessment_mode: mode },
    },
  };
}

const opts = { language: "en" as const, overallLabel: "Overall" };

describe("buildSkillProgress", () => {
  it("orders sessions chronologically and rescales items to 0–100", () => {
    const sessions: ProgressSessionInput[] = [
      { id: "b", started_at: "2026-10-02T10:00:00Z", session_reports: [report(70, [["alliance", 4]])] },
      { id: "a", started_at: "2026-10-01T10:00:00Z", session_reports: [report(50, [["alliance", 2]])] },
    ];
    const p = buildSkillProgress(sessions, opts);
    expect(p.points.map((x) => x.sessionId)).toEqual(["a", "b"]);
    expect(p.points.map((x) => x.sessionNumber)).toEqual([1, 2]);
    expect(p.overall.values).toEqual([50, 70]);
    expect(p.overall.change).toBe(20);
    expect(p.skills[0]).toMatchObject({
      id: "alliance",
      label: "Therapeutic alliance & empathy",
      values: [40, 80],
      first: 40,
      latest: 80,
      change: 40,
    });
  });

  it("leaves heuristic-fallback reports out and counts them", () => {
    const p = buildSkillProgress(
      [
        { id: "a", started_at: "2026-10-01T10:00:00Z", session_reports: report(60, [["safety", 3]]) },
        { id: "b", started_at: "2026-10-02T10:00:00Z", session_reports: [report(20, [["safety", 1]], "heuristic_fallback")] },
        { id: "c", started_at: "2026-10-03T10:00:00Z", session_reports: [] },
      ],
      opts,
    );
    expect(p.points.map((x) => x.sessionId)).toEqual(["a"]);
    expect(p.excludedFallback).toBe(1);
    // A single point has no change.
    expect(p.skills[0]!.change).toBeNull();
  });

  it("keeps canonical skill order, appends custom ids, and marks gaps as null", () => {
    const p = buildSkillProgress(
      [
        { id: "a", started_at: "2026-10-01T10:00:00Z", session_reports: [report(50, [["custom_x", 2], ["safety", 2]])] },
        { id: "b", started_at: "2026-10-02T10:00:00Z", session_reports: [report(60, [["alliance", 3], ["safety", 4]])] },
      ],
      { language: "ar", overallLabel: "الدرجة الكلية" },
    );
    expect(p.skills.map((s) => s.id)).toEqual(["alliance", "safety", "custom_x"]);
    expect(p.skills[0]!.label).toBe("التحالف العلاجي والتعاطف");
    expect(p.skills[0]!.values).toEqual([null, 60]);
    expect(p.skills[2]!.values).toEqual([40, null]);
  });

  it("uses course visit numbers and keeps only the most recent sessions", () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i + 1}`,
      started_at: `2026-10-0${i + 1}T10:00:00Z`,
      course_session_number: i + 1,
      session_reports: [report(40 + i, [])],
    }));
    const p = buildSkillProgress(sessions, { ...opts, limit: 3 });
    expect(p.truncated).toBe(2);
    expect(p.points.map((x) => x.sessionNumber)).toEqual([3, 4, 5]);
    expect(p.skills).toEqual([]);
  });

  it("numbers standalone sessions by position after truncation", () => {
    const sessions = Array.from({ length: 4 }, (_, i) => ({
      id: `s${i + 1}`,
      started_at: `2026-10-0${i + 1}T10:00:00Z`,
      session_reports: [report(50, [])],
    }));
    const p = buildSkillProgress(sessions, { ...opts, limit: 2 });
    expect(p.points.map((x) => x.sessionNumber)).toEqual([3, 4]);
  });
});
