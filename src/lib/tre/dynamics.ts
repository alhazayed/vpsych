/**
 * Diagnosis-conditioned response tempos (evidence-informed educational priors).
 * Catalog slugs and human-readable aliases both resolve.
 */

export type DisorderDynamics = {
  recovery_tempo: number;
  deterioration_tempo: number;
  relapse_sensitivity: number;
  insight_gain_rate: number;
  alliance_sensitivity: number;
  /** Trait-like buffer 0–100 used when seeding TreatmentState. */
  resilience_prior: number;
  /** Baseline per-session relapse_risk drift (before therapy quality). */
  relapse_drift: number;
  category: string | null;
  notes: string[];
};

const BY_CATEGORY: Record<string, DisorderDynamics> = {
  mood: {
    recovery_tempo: 0.5,
    deterioration_tempo: 0.55,
    relapse_sensitivity: 0.65,
    insight_gain_rate: 0.55,
    alliance_sensitivity: 0.6,
    resilience_prior: 45,
    relapse_drift: 1.5,
    category: "mood",
    notes: ["Mood disorders: gradual anhedonia/activation change; relapse after early gains"],
  },
  anxiety: {
    recovery_tempo: 0.55,
    deterioration_tempo: 0.5,
    relapse_sensitivity: 0.55,
    insight_gain_rate: 0.6,
    alliance_sensitivity: 0.55,
    resilience_prior: 50,
    relapse_drift: 1.2,
    category: "anxiety",
    notes: ["Anxiety: skill acquisition gradual; exposure gains with stress setbacks"],
  },
  trauma: {
    recovery_tempo: 0.4,
    deterioration_tempo: 0.6,
    relapse_sensitivity: 0.7,
    insight_gain_rate: 0.45,
    alliance_sensitivity: 0.7,
    resilience_prior: 40,
    relapse_drift: 2,
    category: "trauma",
    notes: ["Trauma: safety/alliance first; processing later; high stress sensitivity"],
  },
  personality: {
    recovery_tempo: 0.38,
    deterioration_tempo: 0.7,
    relapse_sensitivity: 0.65,
    insight_gain_rate: 0.5,
    alliance_sensitivity: 0.85,
    resilience_prior: 42,
    relapse_drift: 2.2,
    category: "personality",
    notes: ["Personality: alliance ruptures amplify; skills accumulate slowly"],
  },
  psychotic: {
    recovery_tempo: 0.3,
    deterioration_tempo: 0.55,
    relapse_sensitivity: 0.75,
    insight_gain_rate: 0.25,
    alliance_sensitivity: 0.6,
    resilience_prior: 38,
    relapse_drift: 2.5,
    category: "psychotic",
    notes: ["Psychosis: functional gains slow; medication adherence dominant"],
  },
  psychosis: {
    recovery_tempo: 0.3,
    deterioration_tempo: 0.55,
    relapse_sensitivity: 0.75,
    insight_gain_rate: 0.25,
    alliance_sensitivity: 0.6,
    resilience_prior: 38,
    relapse_drift: 2.5,
    category: "psychosis",
    notes: ["Psychosis: functional gains slow; medication adherence dominant"],
  },
  substance: {
    recovery_tempo: 0.4,
    deterioration_tempo: 0.7,
    relapse_sensitivity: 0.85,
    insight_gain_rate: 0.45,
    alliance_sensitivity: 0.6,
    resilience_prior: 40,
    relapse_drift: 3,
    category: "substance",
    notes: ["Substance: stage-of-change / MI; high relapse sensitivity"],
  },
  neurodevelopmental: {
    recovery_tempo: 0.45,
    deterioration_tempo: 0.4,
    relapse_sensitivity: 0.35,
    insight_gain_rate: 0.5,
    alliance_sensitivity: 0.45,
    resilience_prior: 52,
    relapse_drift: 0.8,
    category: "neurodevelopmental",
    notes: ["Neurodevelopmental: skill/function focus rather than cure framing"],
  },
  medical: {
    recovery_tempo: 0.25,
    deterioration_tempo: 0.8,
    relapse_sensitivity: 0.5,
    insight_gain_rate: 0.2,
    alliance_sensitivity: 0.4,
    resilience_prior: 30,
    relapse_drift: 1,
    category: "medical",
    notes: ["Medical/delirium: stabilization and medical workup dominate over psychotherapy dose"],
  },
  ocd: {
    recovery_tempo: 0.4,
    deterioration_tempo: 0.55,
    relapse_sensitivity: 0.7,
    insight_gain_rate: 0.55,
    alliance_sensitivity: 0.5,
    resilience_prior: 48,
    relapse_drift: 2,
    category: "ocd",
    notes: ["OCD: ERP gains slow; ritual rebound under stress"],
  },
};

const DEFAULT: DisorderDynamics = {
  recovery_tempo: 0.5,
  deterioration_tempo: 0.55,
  relapse_sensitivity: 0.5,
  insight_gain_rate: 0.5,
  alliance_sensitivity: 0.55,
  resilience_prior: 45,
  relapse_drift: 1.5,
  category: null,
  notes: ["Generic prior — gradual multi-session change only"],
};

/** Slug-specific overrides (catalog + common aliases). */
const BY_SLUG: Record<string, Partial<DisorderDynamics>> = {
  "mdd-recurrent-moderate": {
    recovery_tempo: 0.48,
    relapse_sensitivity: 0.68,
    notes: ["MDD: slow anhedonia lift; relapse risk after early gains"],
  },
  "gad-with-panic": {
    recovery_tempo: 0.55,
    category: "anxiety",
    notes: ["GAD/panic: CBT/ACT skill gains; worry loops persist early"],
  },
  ptsd: {
    recovery_tempo: 0.4,
    alliance_sensitivity: 0.75,
    notes: ["PTSD: titration and safety before deep processing"],
  },
  "complex-ptsd": {
    recovery_tempo: 0.35,
    alliance_sensitivity: 0.8,
    deterioration_tempo: 0.65,
    notes: ["CPTSD: trust-gated; slower than single-incident PTSD"],
  },
  "adult-adhd": {
    recovery_tempo: 0.5,
    category: "neurodevelopmental",
    notes: ["ADHD: executive/function focus; adherence variable"],
  },
  "alcohol-use-disorder": {
    recovery_tempo: 0.4,
    relapse_sensitivity: 0.88,
    notes: ["AUD: MI/stage of change; craving-driven relapse risk"],
  },
  "panic-disorder": {
    recovery_tempo: 0.6,
    notes: ["Panic: exposure gains with inter-session setbacks"],
  },
  bpd: {
    recovery_tempo: 0.4,
    deterioration_tempo: 0.78,
    alliance_sensitivity: 0.9,
    notes: ["BPD: DBT skills gradual; alliance ruptures amplify course"],
  },
  schizophrenia: {
    recovery_tempo: 0.28,
    insight_gain_rate: 0.22,
    notes: ["Schizophrenia: functional gains slow; med adherence dominant"],
  },
  "bipolar-mania": {
    recovery_tempo: 0.42,
    deterioration_tempo: 0.75,
    relapse_sensitivity: 0.82,
    notes: ["Bipolar mania: containment first; med adherence critical; avoid over-activation"],
  },
  delirium: {
    recovery_tempo: 0.2,
    deterioration_tempo: 0.85,
    insight_gain_rate: 0.15,
    notes: ["Delirium: not a psychotherapy-response disorder — medical stabilization"],
  },
};

function inferCategory(slug: string, category?: string | null): string | null {
  if (category) return category;
  const s = slug.toLowerCase();
  if (/mdd|depress|bipolar|mania|dysthym|pdd/.test(s)) return "mood";
  if (/gad|panic|social.?anxiety|phobia|anxiety/.test(s)) return "anxiety";
  if (/ptsd|trauma|acute.?stress/.test(s)) return "trauma";
  if (/bpd|borderline|personality|narciss|avoidant|antisocial/.test(s))
    return "personality";
  if (/schizo|delusion|psychotic|psychosis/.test(s)) return "psychotic";
  if (/alcohol|opioid|stimulant|cannabis|substance|aud/.test(s)) return "substance";
  if (/adhd|autism|asd|neurodev/.test(s)) return "neurodevelopmental";
  if (/ocd|obsessive.?compulsive(?!.?personality)/.test(s)) return "ocd";
  if (/delirium|medical/.test(s)) return "medical";
  return null;
}

export function dynamicsForDisorder(
  slug: string,
  category?: string | null,
): DisorderDynamics {
  const cat = inferCategory(slug, category);
  const base = (cat && BY_CATEGORY[cat]) || DEFAULT;
  const override = BY_SLUG[slug] ?? BY_SLUG[slug.toLowerCase()] ?? {};
  return {
    ...base,
    ...override,
    category: override.category ?? base.category ?? cat,
    notes: override.notes ?? base.notes,
  };
}

/** Resilience prior 0–1 from hope/adherence when mind lacks treatment seed. */
export function estimateResilience(hope: number, adherence: number): number {
  return Math.max(0, Math.min(1, hope / 100 * 0.45 + adherence / 100 * 0.35 + 0.2));
}
