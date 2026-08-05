import { describe, expect, it } from "vitest";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import {
  beginNextSession,
  createInitialMindState,
  processTherapistTurn,
} from "@/lib/pme";
import {
  MODALITY_PROFILES,
  TRI_VERSION,
  TRE_VERSION,
  applySessionTreatment,
  computeTherapyResponseIndex,
  dynamicsForDisorder,
  normalizeModality,
  simulateTreatmentCourse,
  type TreModality,
} from "@/lib/tre";

const ACTIVE = BUILTIN_DISORDERS.filter((d) => d.is_active);

const ALL_MODALITIES = Object.keys(MODALITY_PROFILES) as TreModality[];

describe("TRE modalities", () => {
  it("supports the eight Excellence Program modalities", () => {
    expect(ALL_MODALITIES.sort()).toEqual(
      [
        "act",
        "cbt",
        "crisis_intervention",
        "dbt",
        "family_psychoeducation",
        "motivational_interviewing",
        "psychodynamic",
        "supportive",
      ].sort(),
    );
    expect(normalizeModality("family_therapy")).toBe("family_psychoeducation");
    expect(normalizeModality("MI")).toBe("motivational_interviewing");
  });

  it("versions are locked", () => {
    expect(TRE_VERSION).toBe("1.0.0");
    expect(TRI_VERSION).toBe("1.0.0");
  });
});

describe("TRE response dynamics", () => {
  it("high competence + alliance improves MDD over sessions (gradual)", () => {
    const { treatment, trajectory } = simulateTreatmentCourse({
      modality: "cbt",
      disorder_slug: "mdd-recurrent-moderate",
      category: "mood",
      sessions: 6,
      competence: 85,
      alliance: 78,
      medication_adherence: 80,
    });
    expect(["improving", "plateau"]).toContain(trajectory);
    expect(treatment.outcomes.symptoms).toBeLessThan(60);
    for (const s of treatment.sessions) {
      expect(Math.abs(s.deltas.symptoms ?? 0)).toBeLessThanOrEqual(10);
    }
    const tri = computeTherapyResponseIndex(treatment);
    expect(tri.overall).toBeGreaterThanOrEqual(60);
  });

  it("low competence worsens or disengages", () => {
    const { trajectory, treatment } = simulateTreatmentCourse({
      modality: "cbt",
      disorder_slug: "mdd-recurrent-moderate",
      category: "mood",
      sessions: 5,
      competence: 25,
      alliance: 28,
      medication_adherence: 40,
    });
    expect(["worsening", "disengaged", "plateau", "relapse"]).toContain(
      trajectory,
    );
    expect(treatment.outcomes.engagement).toBeLessThan(55);
  });

  it("negative life events + poor meds can produce relapse after gains", () => {
    let prior = null as ReturnType<typeof applySessionTreatment>["treatment"] | null;
    // Build early gains
    for (let i = 1; i <= 3; i++) {
      prior = applySessionTreatment({
        modality: "cbt",
        therapist_competence: 82,
        alliance_mean: 75,
        medication_adherence: 80,
        disorder_slug: "mdd-recurrent-moderate",
        disorder_category: "mood",
        life_event_valence: "none",
        prior,
        session_index: i,
      }).treatment;
    }
    // Then stress + nonadherence
    for (let i = 4; i <= 6; i++) {
      prior = applySessionTreatment({
        modality: "cbt",
        therapist_competence: 45,
        alliance_mean: 48,
        medication_adherence: 25,
        disorder_slug: "mdd-recurrent-moderate",
        disorder_category: "mood",
        life_event_valence: "negative",
        prior,
        session_index: i,
      }).treatment;
    }
    expect(prior).toBeTruthy();
    expect(["relapse", "worsening", "disengaged"]).toContain(prior!.trajectory);
    expect(prior!.outcomes.relapse_risk).toBeGreaterThan(45);
  });

  it("DBT fits BPD better than generic supportive for emotion regulation gains", () => {
    const dbt = simulateTreatmentCourse({
      modality: "dbt",
      disorder_slug: "bpd",
      category: "personality",
      sessions: 6,
      competence: 80,
      alliance: 70,
    });
    const supportive = simulateTreatmentCourse({
      modality: "supportive",
      disorder_slug: "bpd",
      category: "personality",
      sessions: 6,
      competence: 80,
      alliance: 70,
    });
    expect(dbt.treatment.outcomes.emotion_regulation).toBeGreaterThanOrEqual(
      supportive.treatment.outcomes.emotion_regulation - 2,
    );
  });
});

describe("TRE per-disorder regression", () => {
  it("covers every active builtin disorder", () => {
    expect(ACTIVE.length).toBeGreaterThanOrEqual(10);
  });

  for (const disorder of ACTIVE) {
    it(`${disorder.slug}: high-competence course is gradual and TRI-scorable`, () => {
      const dyn = dynamicsForDisorder(disorder.slug, disorder.category);
      expect(dyn.recovery_tempo).toBeGreaterThan(0);
      expect(dyn.deterioration_tempo).toBeGreaterThan(0);

      const preferred: TreModality =
        disorder.category === "personality"
          ? "dbt"
          : disorder.category === "substance"
            ? "motivational_interviewing"
            : disorder.category === "psychotic"
              ? "family_psychoeducation"
              : disorder.category === "medical"
                ? "crisis_intervention"
                : "cbt";

      const { treatment, trajectory } = simulateTreatmentCourse({
        modality: preferred,
        disorder_slug: disorder.slug,
        category: disorder.category,
        sessions: 6,
        competence: 80,
        alliance: 72,
        medication_adherence: 75,
      });

      expect([
        "improving",
        "plateau",
        "worsening",
        "relapse",
        "disengaged",
      ]).toContain(trajectory);

      for (const s of treatment.sessions) {
        expect(Math.abs(s.deltas.symptoms ?? 0)).toBeLessThanOrEqual(10);
      }

      // No miracle cure in 6 sessions
      const start = 60;
      const end = treatment.outcomes.symptoms;
      expect(start - end).toBeLessThan(35);

      const tri = computeTherapyResponseIndex(treatment);
      expect(tri.overall).toBeGreaterThanOrEqual(50);
      expect(tri.subscores).toHaveLength(10);
      expect(tri.version).toBe(TRI_VERSION);
    });

    it(`${disorder.slug}: low-competence course does not falsely improve`, () => {
      const { treatment, trajectory } = simulateTreatmentCourse({
        modality: "supportive",
        disorder_slug: disorder.slug,
        category: disorder.category,
        sessions: 5,
        competence: 22,
        alliance: 25,
        medication_adherence: 35,
      });
      expect(trajectory).not.toBe("improving");
      // Symptoms should not drop dramatically under poor therapy
      expect(treatment.outcomes.symptoms).toBeGreaterThan(45);
    });
  }
});

describe("TRE ↔ PME bridge", () => {
  it("beginNextSession applies TRE and injects Module TRE in expression", () => {
    let mind = createInitialMindState({
      snapshot: null,
      disorderSlug: "mdd-recurrent-moderate",
      category: "mood",
    });
    for (let i = 0; i < 4; i++) {
      mind = processTherapistTurn(
        mind,
        "That sounds really hard. I'm glad you came. What was that like for you?",
        { turnIndex: i + 1 },
      ).mind;
    }
    expect(mind.treatment).toBeTruthy();

    const next = beginNextSession(mind, {
      seed: "tre-bridge-1",
      modality: "cbt",
    });
    expect(next.therapy.session_index).toBe(2);
    expect(next.treatment?.sessions.length).toBeGreaterThanOrEqual(1);
    expect(next.turn_traces).toHaveLength(0);

    const opened = processTherapistTurn(
      next,
      "How have things been since last time?",
      { turnIndex: 1 },
    );
    expect(opened.expressionBlock).toMatch(/MODULE TRE/i);
    expect(opened.expressionBlock).toMatch(/Trajectory/i);
  });
});
