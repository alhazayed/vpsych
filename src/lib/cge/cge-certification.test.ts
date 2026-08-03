import { describe, expect, it } from "vitest";
import { COMPETENCY_IDS } from "@/lib/ace/catalog";
import {
  createEmptyLearnerStates,
  findCycle,
  getBuiltinGraph,
  getLearnerGraph,
  isMastered,
  statesFromAceCompetencies,
  updateCompetencyScore,
  validatePrerequisites,
} from "@/lib/cge";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Competency Graph certification guards", () => {
  it("has an acyclic graph with valid prerequisites", () => {
    const g = getBuiltinGraph();
    expect(findCycle(g)).toBeNull();
    expect(validatePrerequisites(g)).toEqual([]);
  });

  it("covers every CGE node in the ACE competency catalog", () => {
    const ace = new Set(COMPETENCY_IDS);
    const missing = getBuiltinGraph()
      .nodes.filter((n) => n.enabled)
      .map((n) => n.id)
      .filter((id) => !ace.has(id as never));
    expect(missing, missing.join(",")).toEqual([]);
  });

  it("allows mastery when ACE assesses the full prerequisite chain", () => {
    const g = getBuiltinGraph();
    const competencies = COMPETENCY_IDS.map((id) => ({
      competency_id: id,
      score: 92,
      samples: 6,
      trend: 1,
    }));
    const states = statesFromAceCompetencies(competencies, g);
    const learner = getLearnerGraph("cert-strong", states, g);
    const clinical = [
      "diagnostic_interview",
      "treatment_planning",
      "risk_assessment",
      "therapeutic_alliance",
    ];
    for (const id of clinical) {
      const node = learner.nodes.find((n) => n.competency_id === id)!;
      expect(isMastered(node.stage), id).toBe(true);
    }
    expect(learner.mastered.length).toBeGreaterThanOrEqual(30);
  });

  it("recalculates mastery in topological order (stale prereq stage bug)", () => {
    const g = getBuiltinGraph();
    let states = createEmptyLearnerStates(g).map((s) => {
      if (
        s.competency_id === "clinical_communication" ||
        s.competency_id === "diagnostic_interview"
      ) {
        return {
          ...s,
          score: 95,
          samples: 10,
          // Intentionally stale stage field — gate must recompute topo
          stage: "not_attempted" as const,
          confidence: 90,
        };
      }
      return s;
    });
    const learner = getLearnerGraph("topo", states, g);
    expect(
      learner.nodes.find((n) => n.competency_id === "diagnostic_interview")
        ?.stage,
    ).not.toBe("developing");
    expect(
      isMastered(
        learner.nodes.find((n) => n.competency_id === "diagnostic_interview")!
          .stage,
      ),
    ).toBe(true);
  });

  it("refuses score updates on instructor-locked competencies", () => {
    let states = createEmptyLearnerStates();
    states = states.map((s) =>
      s.competency_id === "diagnostic_interview"
        ? { ...s, locked: true, score: 75, samples: 3, stage: "developing" }
        : s,
    );
    const next = updateCompetencyScore(states, "diagnostic_interview", 99);
    expect(
      next.find((s) => s.competency_id === "diagnostic_interview")!.score,
    ).toBe(75);
  });

  it("differentiates weak / average / excellent progression", () => {
    const g = getBuiltinGraph();
    const path = [
      "clinical_communication",
      "diagnostic_interview",
      "mental_status_examination",
      "dsm5_reasoning",
      "risk_screening",
      "risk_assessment",
      "therapeutic_alliance",
      "empathy",
      "differential_diagnosis",
      "case_formulation",
      "treatment_planning",
    ] as const;

    function run(base: number) {
      let st = createEmptyLearnerStates(g);
      for (const id of path) {
        for (let i = 0; i < 4; i++) {
          st = updateCompetencyScore(st, id, base);
        }
      }
      return getLearnerGraph(`arch-${base}`, st, g);
    }

    const weak = run(45);
    const avg = run(72);
    const excel = run(92);
    expect(weak.mastered.length).toBeLessThan(avg.mastered.length);
    expect(avg.mastered.length).toBeLessThanOrEqual(excel.mastered.length);
    expect(excel.mastered.length).toBeGreaterThan(0);
    expect(weak.blocked.length).toBeGreaterThan(excel.blocked.length);
  });

  it("admin lock/approve routes preserve evidence and instructor overlay wires userId", () => {
    const root = join(process.cwd(), "src");
    const admin = readFileSync(join(root, "app/api/admin/cge/route.ts"), "utf8");
    expect(admin).toMatch(/Preserve evidence/);
    expect(admin).toMatch(/from_stage: fromStage/);
    expect(admin).not.toMatch(/score: 80,\s*samples: 3/);
    const panel = readFileSync(
      join(root, "components/cge/InstructorGraphPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/userId=\{selectedUserId/);
    expect(panel).toMatch(/Institution cohort summary/);
    const mastery = readFileSync(
      join(root, "app/api/cge/mastery/route.ts"),
      "utf8",
    );
    expect(mastery).toMatch(/persisted: true/);
    expect(mastery).toMatch(/cge_attempts/);
    expect(mastery).toMatch(/cge_mastery_history/);
  });
});
