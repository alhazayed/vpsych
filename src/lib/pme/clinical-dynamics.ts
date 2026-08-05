/**
 * Module 8 — Clinical behaviour dynamics by disorder.
 */

import type { ClinicalDynamics } from "@/lib/pme/types";

export function clinicalDynamicsFor(
  slug: string,
  category: string | null,
  risk: {
    suicidal_ideation?: string;
    self_harm?: boolean;
    harm_to_others?: boolean;
  },
): ClinicalDynamics {
  const directives = behaviourForSlug(slug, category);
  let risk_level: ClinicalDynamics["risk_level"] = "none";
  const si = risk.suicidal_ideation ?? "none";
  if (si === "active" || risk.harm_to_others) risk_level = "high";
  else if (si === "passive" || risk.self_harm) risk_level = "moderate";
  else if (si && si !== "none") risk_level = "low";

  return {
    disorder_slug: slug,
    category,
    behaviour_directives: directives,
    risk_level,
  };
}

function behaviourForSlug(slug: string, category: string | null): string[] {
  if (/mdd|depress/i.test(slug) || category === "mood") {
    if (/mania|bipolar/i.test(slug)) {
      return [
        "Mania dynamics: pressured ideas, fluctuating insight, grandiosity or irritability — not mere happiness.",
        "Energy and sleep need stay elevated/reduced unless longitudinal engine says otherwise.",
        "Slow to accept limits; may joke past concerns.",
      ];
    }
    return [
      "Depression dynamics: slow recovery arc; hopelessness and low energy; relapse risk under stress.",
      "Reduced spontaneity; effortful speech; minimize positives.",
      "Do not brighten instantly after one empathic line.",
    ];
  }
  if (/schizo/i.test(slug) || category === "psychosis") {
    return [
      "Psychosis dynamics: thought disorder / negative symptoms / guarded conviction — not depression with hallucinations tacked on.",
      "Suspiciousness with strangers; concrete or tangential answers.",
      "Insight may be partial; do not suddenly psychoeducate.",
    ];
  }
  if (/ocd/i.test(slug)) {
    return [
      "OCD dynamics: uncertainty, mental rituals, reassurance seeking, compulsive language.",
      "Ritual escalation under stress; avoidance of triggers.",
    ];
  }
  if (/ptsd|trauma/i.test(slug) || category === "trauma") {
    return [
      "PTSD dynamics: avoidance, hypervigilance, fragmented memory near triggers.",
      "Flashback energy is brief and sensory — not a neat narrative dump.",
      "Guilt/shame colour disclosure readiness.",
    ];
  }
  if (/bpd|borderline/i.test(slug) || category === "personality") {
    return [
      "BPD dynamics: attachment instability, fear of abandonment, rapid affective shifts.",
      "Idealize then devalue if therapist feels cold; test and correct mid-thought.",
    ];
  }
  if (/alcohol|substance/i.test(slug) || category === "substance") {
    return [
      "Substance dynamics: minimization and bargaining early; openness rises with nonjudgmental curiosity.",
      "Inconsistent amounts are human; correct yourself awkwardly.",
    ];
  }
  if (/gad|anxiety|panic/i.test(slug) || category === "anxiety") {
    return [
      "Anxiety dynamics: worry spillover, body focus, reassurance seeking then doubt.",
      "Panic content stays guarded until trust builds.",
    ];
  }
  return [
    "Stay syndrome-consistent across the session; change only via PME longitudinal/emotion engines.",
  ];
}
