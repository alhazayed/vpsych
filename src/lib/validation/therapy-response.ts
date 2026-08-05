/**
 * Workstream D — Therapy response validation harness.
 * Runs scripted therapist styles through PME and checks gradual, plausible change.
 */

import {
  createInitialMindState,
  processTherapistTurn,
  type PatientMindState,
} from "@/lib/pme";
import type {
  TherapyResponseObservation,
  TherapyStyleId,
} from "@/lib/validation/types";

const STYLE_SCRIPTS: Record<TherapyStyleId, string[]> = {
  supportive: [
    "I'm glad you came in today. How have things been?",
    "That sounds really hard. I'm with you.",
    "Thank you for sharing that — take your time.",
    "What would feel most supportive right now?",
  ],
  cbt: [
    "What went through your mind when that happened?",
    "What evidence supports that thought, and what might not?",
    "Would a small activity between now and next time feel doable?",
    "How did that thought affect what you did afterward?",
  ],
  motivational_interviewing: [
    "On a scale of 0 to 10, how ready do you feel to make a change?",
    "What are your reasons for wanting things to be different?",
    "What would be the pros and cons of staying the same?",
    "What might a first step look like for you?",
  ],
  dbt: [
    "Can we name the emotion showing up right now?",
    "What would wise mind say about this moment?",
    "Let's try one grounding skill together — what do you notice?",
    "How can we validate how painful this is and still choose a next step?",
  ],
  psychodynamic: [
    "What does that remind you of from earlier relationships?",
    "I notice a shift when we get close to that topic — what do you make of that?",
    "How do you imagine I might be seeing you right now?",
    "What's the feeling underneath the story?",
  ],
  crisis: [
    "I need to ask directly — have you had thoughts of ending your life?",
    "Are you safe right now? Do you have a plan?",
    "I'm concerned and I want us to make a safety plan together.",
    "Who can be with you tonight if things get heavier?",
  ],
};

function meanDisclosure(mind: PatientMindState): number {
  if (!mind.disclosure.length) return 0;
  return (
    mind.disclosure.reduce((a, d) => a + d.readiness, 0) / mind.disclosure.length
  );
}

export function runTherapyStyleSimulation(opts: {
  style: TherapyStyleId;
  disorderSlug?: string;
  category?: string | null;
}): TherapyResponseObservation {
  const script = STYLE_SCRIPTS[opts.style];
  let mind = createInitialMindState({
    snapshot: null,
    disorderSlug: opts.disorderSlug ?? "mdd-recurrent-moderate",
    category: opts.category ?? "mood",
  });
  const trust0 = mind.relationship.trust;
  const alliance0 = mind.relationship.alliance;
  const disc0 = meanDisclosure(mind);
  const hope0 = mind.emotional_state.hope;
  const trustSeries = [trust0];

  script.forEach((line, i) => {
    mind = processTherapistTurn(mind, line, { turnIndex: i + 1 }).mind;
    trustSeries.push(mind.relationship.trust);
  });

  const trust_delta = mind.relationship.trust - trust0;
  const alliance_delta = mind.relationship.alliance - alliance0;
  const disclosure_mean_delta = meanDisclosure(mind) - disc0;
  const hope_delta = mind.emotional_state.hope - hope0;

  // Resistance proxy: confrontational crisis may raise defenses / lower trust briefly
  const resistance_proxy = mind.current_defenses.length * 10 +
    (trust_delta < 0 ? Math.abs(trust_delta) : 0);

  // Gradual: no single-step trust jump > 8
  let maxJump = 0;
  for (let i = 1; i < trustSeries.length; i++) {
    maxJump = Math.max(maxJump, Math.abs(trustSeries[i]! - trustSeries[i - 1]!));
  }
  const gradual = maxJump <= 8;

  const notes: string[] = [];
  let clinically_plausible = true;

  if (opts.style === "supportive" || opts.style === "motivational_interviewing") {
    if (trust_delta < -2) {
      clinically_plausible = false;
      notes.push("Warm/MI style unexpectedly reduced trust.");
    }
  }
  if (opts.style === "crisis") {
    notes.push(
      "Crisis style may transiently raise activation/defenses while assessing risk — expected.",
    );
  }
  if (!gradual) {
    clinically_plausible = false;
    notes.push(`Abrupt trust jump detected (max ${maxJump}).`);
  }
  if (opts.style === "cbt" && mind.therapy.motivation < 30) {
    notes.push("CBT script did not raise motivation — check alliance first.");
  }

  return {
    style: opts.style,
    turns: script.length,
    trust_delta: Math.round(trust_delta * 10) / 10,
    alliance_delta: Math.round(alliance_delta * 10) / 10,
    disclosure_mean_delta: Math.round(disclosure_mean_delta * 10) / 10,
    hope_delta: Math.round(hope_delta * 10) / 10,
    resistance_proxy: Math.round(resistance_proxy * 10) / 10,
    gradual,
    clinically_plausible,
    notes,
  };
}

export function runAllTherapyStyleValidations(disorderSlug?: string) {
  const styles = Object.keys(STYLE_SCRIPTS) as TherapyStyleId[];
  const observations = styles.map((style) =>
    runTherapyStyleSimulation({ style, disorderSlug }),
  );
  const pass = observations.filter((o) => o.gradual && o.clinically_plausible)
    .length;
  return {
    disorder_slug: disorderSlug ?? "mdd-recurrent-moderate",
    observations,
    pass_rate: Math.round((pass / observations.length) * 1000) / 10,
    recommendations:
      pass < observations.length
        ? [
            "One or more therapy styles failed gradual/plausible checks — inspect PME therapist-effect weights.",
          ]
        : [
            "All scripted styles passed gradualism checks — proceed to human rater confirmation.",
          ],
  };
}
