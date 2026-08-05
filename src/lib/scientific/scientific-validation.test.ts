/**
 * Mission 19 — Scientific Validation Certification suite.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import {
  DISORDER_EVIDENCE,
  evidenceForSlug,
  runScientificValidation,
  PROMPT_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  buildAssessmentProvenance,
  simulateEducationalOutcomes,
  cronbachAlpha,
} from "@/lib/scientific";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT =
  process.env.VPSYCH_SCIENCE_OUT || "/opt/cursor/artifacts/scientific-cert";

const persona: PersonaRow = {
  id: "p1",
  avatar_id: "a1",
  slug: "maya-chen",
  display_name: "Maya",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

describe("Mission 19 — Scientific Validation", () => {
  it("locks evidence citations for every builtin disorder", () => {
    for (const d of BUILTIN_DISORDERS) {
      const ev = evidenceForSlug(d.slug);
      expect(ev, `missing evidence for ${d.slug}`).toBeTruthy();
      expect(ev!.citations.length).toBeGreaterThanOrEqual(2);
      expect(ev!.icd11_code).toBe(d.icd11_code);
      if (d.dsm5_code) expect(ev!.dsm5_code).toBe(d.dsm5_code);
    }
    expect(DISORDER_EVIDENCE.length).toBeGreaterThanOrEqual(10);
  });

  it("does not invent diagnosis correctness from overall score", () => {
    const hook = readFileSync(
      join(process.cwd(), "src/lib/ace/session-hook.ts"),
      "utf8",
    );
    expect(hook).not.toMatch(/correctDiagnosis:\s*opts\.overall\s*>=\s*55/);
    expect(hook).toMatch(/correctDiagnosis:\s*opts\.correctDiagnosis/);
  });

  it("embeds scientific_meta on generated CaseInstances", () => {
    const disorder = BUILTIN_DISORDERS[0]!;
    const gen = generateCaseInstance({
      persona,
      avatarId: "a1",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "m19-meta",
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.snapshot.scientific_meta?.prompt_engine_version).toBe(
      PROMPT_ENGINE_VERSION,
    );
    expect(gen.snapshot.scientific_meta?.assessment_schema_version).toBe(
      ASSESSMENT_SCHEMA_VERSION,
    );
  });

  it("discloses heuristic assessment as non-validated", () => {
    const p = buildAssessmentProvenance({
      aiSource: "persona_fallback",
      model: null,
    });
    expect(p.assessment_mode).toBe("heuristic_fallback");
    expect(p.scientific_limitations?.length).toBeGreaterThan(0);
  });

  it("runs ≥100 simulated educational outcome sessions with improvement", () => {
    const sim = simulateEducationalOutcomes(100);
    expect(sim.sessions).toBeGreaterThanOrEqual(100);
    expect(Object.keys(sim.by_archetype).length).toBe(6);
    expect(sim.overall_improved_fraction).toBeGreaterThan(0.5);
    expect(sim.psychometrics.n_scores).toBeGreaterThanOrEqual(100);
  });

  it("computes Cronbach alpha on multi-item matrices", () => {
    const matrix = [
      [80, 70, 75, 60, 65],
      [82, 72, 78, 62, 68],
      [60, 55, 58, 50, 52],
      [90, 88, 85, 80, 82],
    ];
    const a = cronbachAlpha(matrix);
    expect(a).not.toBeNull();
    expect(a!).toBeGreaterThan(0.5);
  });

  it("board certification produces metrics and writes artifacts", () => {
    const board = runScientificValidation();
    expect(board.critical_remaining).toEqual([]);
    expect(board.metrics.overall).toBeGreaterThanOrEqual(70);
    expect(board.verdict).not.toBe("SCIENTIFIC_VALIDATION_FAILED");
    expect(board.metrics.CFI).toBeGreaterThan(0);
    expect(board.outcome_simulation.sessions).toBeGreaterThanOrEqual(100);

    try {
      fs.mkdirSync(ARTIFACT, { recursive: true });
      fs.writeFileSync(
        path.join(ARTIFACT, "scientific-board.json"),
        JSON.stringify(board, null, 2),
      );
      fs.writeFileSync(
        path.join(ARTIFACT, "evidence-matrix.json"),
        JSON.stringify(DISORDER_EVIDENCE, null, 2),
      );
      fs.writeFileSync(
        path.join(ARTIFACT, "metrics.json"),
        JSON.stringify(
          { metrics: board.metrics, justifications: board.justifications },
          null,
          2,
        ),
      );
    } catch {
      /* optional */
    }
  });
});
