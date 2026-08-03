import { describe, expect, it } from "vitest";
import {
  MIN_SESSIONS_PER_LEARNER,
  PROFESSION_JOURNEYS,
  runEducationalOutcomesCertification,
  runReliabilityProbe,
  runRetentionProbe,
} from "@/lib/educational-outcomes";
import { writeEducationalOutcomesArtifact } from "@/lib/educational-outcomes/write-artifact";

describe("Educational Outcomes Certification", () => {
  it("defines five profession journeys", () => {
    expect(PROFESSION_JOURNEYS.map((p) => p.profession)).toEqual([
      "medical_student",
      "psychiatry_resident",
      "psychologist",
      "general_practitioner",
      "counselor",
    ]);
    expect(MIN_SESSIONS_PER_LEARNER).toBeGreaterThanOrEqual(50);
  });

  it("reliability of identical assessments stays within tolerance", () => {
    const rel = runReliabilityProbe(12);
    expect(rel.repeats).toBe(12);
    expect(rel.acceptable, `sd=${rel.std_dev} max=${rel.max_abs_dev}`).toBe(
      true,
    );
  });

  it("retention after idle gap remains acceptable", () => {
    const ret = runRetentionProbe(75);
    expect(ret.gap_days).toBe(75);
    expect(ret.acceptable, `ratio=${ret.retained_ratio}`).toBe(true);
  });

  it(
    "runs complete educational journeys (≥50 assessments × 5 roles × 3 tiers)",
    () => {
      const report = runEducationalOutcomesCertification(50);
      expect(report.sessions_per_learner).toBe(50);
      expect(report.journeys).toHaveLength(5);

      for (const j of report.journeys) {
        expect(j.tiers).toHaveLength(3);
        for (const t of j.tiers) {
          expect(t.growth.sessions).toBe(50);
        }
        expect(j.assessment_quality_ok).toBe(true);
        expect(j.feedback_usefulness.ok).toBe(true);
      }

      expect(report.board.weak_learners_improve).toBe(true);
      expect(report.board.average_learners_progress).toBe(true);
      expect(report.board.excellent_learners_challenged).toBe(true);
      expect(report.reliability.acceptable).toBe(true);
      expect(report.retention.acceptable).toBe(true);
      expect(report.board.effectiveness_score).toBeGreaterThanOrEqual(80);
      expect(report.board.verdict).not.toBe("FAILED");

      writeEducationalOutcomesArtifact(
        "/opt/cursor/artifacts/educational-outcomes-cert/outcomes-report.json",
      );
    },
    180_000,
  );
});
