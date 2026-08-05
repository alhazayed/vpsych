/**
 * Patient Mind Fidelity Index — scores PME architecture + state dynamics.
 */

import { PME_VERSION } from "@/lib/pme/types";
import {
  PMFI_VERSION,
  PMFI_WEIGHT_MATRIX,
  pmfiWeightMap,
  type PmfiDimensionId,
} from "@/lib/pmfi/weights";
import type {
  PatientMindFidelityIndex,
  PmfiComputeInput,
  PmfiDimensionScore,
} from "@/lib/pmfi/types";

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: PmfiDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  recommendations: string[],
): PmfiDimensionScore {
  const weight = pmfiWeightMap()[id];
  const s = clamp(score);
  return {
    id,
    score: s,
    weight,
    weighted_contribution: Math.round(s * weight * 10) / 10,
    confidence,
    evidence,
    recommendations,
  };
}

export function computePatientMindFidelityIndex(
  input: PmfiComputeInput,
): PatientMindFidelityIndex {
  const m = input.mind;
  const traces = m.turn_traces;
  const subs: PmfiDimensionScore[] = [];

  // Psychological consistency — required fields present + version lock
  {
    let score = 70;
    const ev: string[] = [];
    if (m.pme_version === PME_VERSION) {
      score += 10;
      ev.push("pme_version_lock");
    }
    if (m.emotional_state && m.disclosure?.length >= 5) {
      score += 10;
      ev.push("full_state_modules");
    }
    if (input.expressionLayerWired) {
      score += 8;
      ev.push("expression_layer_wired");
    } else {
      score -= 15;
      ev.push("expression_layer_unwired");
    }
    subs.push(
      dim(
        "psychological_consistency",
        score,
        80,
        ev,
        input.expressionLayerWired
          ? []
          : ["Wire PME expression block into patient prompt."],
      ),
    );
  }

  // Relationship continuity
  {
    let score = 55;
    const ev: string[] = [`trust:${m.relationship.trust}`, `alliance:${m.relationship.alliance}`];
    if (traces.length >= 2) {
      const deltas = [];
      for (let i = 1; i < traces.length; i++) {
        deltas.push(Math.abs(traces[i]!.trust - traces[i - 1]!.trust));
      }
      const maxJump = Math.max(...deltas, 0);
      if (maxJump <= 8) {
        score += 25;
        ev.push(`max_trust_jump:${maxJump}`);
      } else {
        score -= 10;
        ev.push(`abrupt_trust_jump:${maxJump}`);
      }
    } else {
      score += 10;
      ev.push("insufficient_traces_for_jump_test");
    }
    if (m.relationship.sessions_together >= 1) score += 5;
    subs.push(
      dim("relationship_continuity", score, 75, ev, []),
    );
  }

  // Behavior realism
  {
    const score = m.clinical.behaviour_directives.length >= 2 ? 78 : 50;
    const ev = [`directives:${m.clinical.behaviour_directives.length}`, `slug:${m.diagnosis.slug}`];
    subs.push(
      dim(
        "behavior_realism",
        score,
        72,
        ev,
        score < 70 ? ["Attach disorder dynamics at mind init."] : [],
      ),
    );
  }

  // Defense realism
  {
    let score = 60;
    const ev: string[] = [];
    if (traces.some((t) => t.defenses_active.length > 0)) {
      score += 20;
      ev.push("defenses_activated");
    }
    if (m.current_defenses.length > 0 && m.current_defenses.length <= 3) {
      score += 10;
      ev.push(`active:${m.current_defenses.join(",")}`);
    }
    subs.push(dim("defense_realism", score, 70, ev, []));
  }

  // Disclosure realism — continuous readiness
  {
    const levels = new Set(m.disclosure.map((d) => d.last_level));
    let score = 65;
    const ev = [`topics:${m.disclosure.length}`, `levels:${[...levels].join("|")}`];
    if (m.disclosure.every((d) => d.readiness >= 0 && d.readiness <= 100)) {
      score += 15;
      ev.push("continuous_readiness");
    }
    const dumped = m.disclosure.filter((d) => d.last_level === "open" && d.times_approached === 0);
    if (dumped.length) {
      score -= 25;
      ev.push("unearned_open_disclosure");
    } else {
      score += 8;
    }
    subs.push(dim("disclosure_realism", score, 74, ev, []));
  }

  // Therapy realism — therapist cues affect traces
  {
    let score = 58;
    const ev: string[] = [];
    if (traces.some((t) => t.therapist_cues.length > 0)) {
      score += 20;
      ev.push("therapist_cues_recorded");
    }
    if (m.therapy.motivation >= 0) {
      score += 10;
      ev.push(`motivation:${m.therapy.motivation}`);
    }
    subs.push(dim("therapy_realism", score, 68, ev, []));
  }

  // Session continuity
  {
    const phases = new Set(traces.map((t) => t.phase));
    const score = 60 + Math.min(25, phases.size * 6);
    const ev = [`phase_now:${m.therapy.phase}`, `phases_seen:${phases.size}`];
    subs.push(dim("session_continuity", score, 70, ev, []));
  }

  // Emotional continuity vs prior
  {
    let score = 70;
    const ev: string[] = [];
    if (input.priorMind) {
      const dHope = Math.abs(
        m.emotional_state.hope - input.priorMind.emotional_state.hope,
      );
      if (dHope <= 15) {
        score += 15;
        ev.push(`hope_delta:${dHope}`);
      } else {
        score -= 12;
        ev.push(`hope_flip:${dHope}`);
      }
    } else {
      ev.push("no_prior_snapshot");
      score += 5;
    }
    subs.push(dim("emotional_continuity", score, 68, ev, []));
  }

  // Longitudinal
  {
    let score = 55;
    const ev = [
      `sessions_together:${m.relationship.sessions_together}`,
      `life_events:${m.life_events.length}`,
    ];
    if (m.relationship.sessions_together > 1) score += 20;
    if (m.life_events.length > 0) score += 15;
    if (input.persisted) score += 5;
    subs.push(
      dim(
        "longitudinal_realism",
        score,
        65,
        ev,
        m.life_events.length === 0
          ? ["Generate inter-session life events for returning patients."]
          : [],
      ),
    );
  }

  // Authenticity — expression wiring + no AI ownership of state
  {
    let score = input.expressionLayerWired ? 80 : 45;
    const ev = [
      input.expressionLayerWired ? "pme_expression_active" : "llm_owns_state",
      input.persisted ? "mind_persisted" : "mind_ephemeral",
    ];
    if (input.persisted) score += 8;
    subs.push(
      dim(
        "patient_authenticity",
        score,
        70,
        ev,
        input.expressionLayerWired
          ? []
          : ["PME must own psychology; LLM expression only."],
      ),
    );
  }

  // Ensure all dimensions present in weight order
  const byId = Object.fromEntries(subs.map((s) => [s.id, s])) as Record<
    PmfiDimensionId,
    PmfiDimensionScore
  >;
  const subscores = PMFI_WEIGHT_MATRIX.map((w) => byId[w.id]!);
  const overall = clamp(
    subscores.reduce((a, s) => a + s.score * s.weight, 0),
  );
  const conf =
    subscores.reduce((a, s) => a + s.confidence, 0) / subscores.length;
  const uncertainty = (100 - conf) * 0.25;
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 8);

  return {
    overall,
    subscores,
    confidence_interval: {
      lower: clamp(overall - uncertainty),
      upper: clamp(overall + uncertainty),
      method: "weighted_dimension_uncertainty",
      level: 0.95,
    },
    evidence: {
      disorder_slug: m.diagnosis.slug,
      sessions_together: m.relationship.sessions_together,
      turn_traces: traces.length,
      phase: m.therapy.phase,
    },
    clinical_reasoning: `PMFI ${overall}/100 — PME ${m.pme_version} for ${m.diagnosis.slug}; phase ${m.therapy.phase}; trust ${m.relationship.trust}.`,
    recommendations,
    versions: {
      pmfi_version: PMFI_VERSION,
      pme_version: m.pme_version,
      computed_at: new Date().toISOString(),
    },
  };
}
