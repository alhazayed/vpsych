/**
 * In-character self-report — deterministic PHQ-9 / GAD-7 item frequencies
 * derived from the frozen case (severity, symptom domains, risk), so the
 * patient answers a questionnaire consistently with the case they portray.
 *
 * Case-derived targets, not validated norms. The patient never volunteers
 * a questionnaire, a total, or a severity label.
 */

import type { ClinicalCore, SymptomProfileItem } from "@/lib/types";
import type {
  SelfReportProfile,
  SelfReportTarget,
} from "@/lib/session-practice/types";

type Domain = NonNullable<SymptomProfileItem["domain"]>;

type ItemSpec = { label: string; domains: Domain[] };

export const PHQ9_ITEMS: readonly ItemSpec[] = [
  { label: "little interest or pleasure in doing things", domains: ["mood", "behavioral"] },
  { label: "feeling down, depressed, or hopeless", domains: ["mood"] },
  { label: "trouble falling or staying asleep, or sleeping too much", domains: ["sleep"] },
  { label: "feeling tired or having little energy", domains: ["somatic", "mood", "sleep"] },
  { label: "poor appetite or overeating", domains: ["appetite"] },
  { label: "feeling bad about yourself, or that you are a failure", domains: ["mood", "cognition"] },
  { label: "trouble concentrating", domains: ["cognition"] },
  { label: "moving or speaking slowly, or being fidgety and restless", domains: ["behavioral", "somatic"] },
  { label: "thoughts that you would be better off dead, or of hurting yourself", domains: [] },
];

export const GAD7_ITEMS: readonly ItemSpec[] = [
  { label: "feeling nervous, anxious, or on edge", domains: ["anxiety"] },
  { label: "not being able to stop or control worrying", domains: ["anxiety"] },
  { label: "worrying too much about different things", domains: ["anxiety", "cognition"] },
  { label: "trouble relaxing", domains: ["anxiety", "somatic"] },
  { label: "being so restless that it is hard to sit still", domains: ["anxiety", "behavioral"] },
  { label: "becoming easily annoyed or irritable", domains: ["mood", "anxiety"] },
  { label: "feeling afraid as if something awful might happen", domains: ["anxiety", "trauma"] },
];

export const FREQUENCY_LABELS = [
  "not at all",
  "several days",
  "more than half the days",
  "nearly every day",
] as const;

const SEVERITY_LEVEL: Record<NonNullable<ClinicalCore["severity"]>, number> = {
  subclinical: 0.5,
  mild: 1.1,
  moderate: 2,
  severe: 2.6,
};

/** Off-profile items still register a little at higher severities. */
const OFF_PROFILE_FACTOR = 0.35;

const SUICIDAL_ITEM: Record<string, number> = {
  none: 0,
  passive: 1,
  active_no_plan: 2,
  active_with_plan: 2,
};

function clampItem(n: number): number {
  return Math.max(0, Math.min(3, Math.round(n)));
}

function presentDomains(core: ClinicalCore): Set<Domain> | null {
  const domains = (core.symptom_profile ?? [])
    .map((s) => s.domain)
    .filter((d): d is Domain => Boolean(d));
  return domains.length > 0 ? new Set(domains) : null;
}

function legacyRelevance(disorder: string, measure: "phq9" | "gad7"): number {
  const d = disorder.toLowerCase();
  if (measure === "phq9") return /depress|اكتئاب/u.test(d) ? 1 : 0.5;
  return /anxi|panic|phobi|قلق|هلع/u.test(d) ? 1 : 0.5;
}

function buildTarget(
  measure: "phq9" | "gad7",
  specs: readonly ItemSpec[],
  core: ClinicalCore,
): SelfReportTarget {
  const level = SEVERITY_LEVEL[core.severity ?? "moderate"];
  const domains = presentDomains(core);
  const items = specs.map((spec, index) => {
    if (measure === "phq9" && index === 8) {
      return SUICIDAL_ITEM[core.risk_profile?.suicidal_ideation ?? "none"] ?? 0;
    }
    const relevance = domains
      ? spec.domains.some((d) => domains.has(d))
        ? 1
        : OFF_PROFILE_FACTOR
      : legacyRelevance(core.disorder ?? "", measure);
    return clampItem(level * relevance);
  });
  return { measure, items, total: items.reduce((a, n) => a + n, 0) };
}

export function deriveSelfReportProfile(core: ClinicalCore): SelfReportProfile {
  return {
    phq9: buildTarget("phq9", PHQ9_ITEMS, core),
    gad7: buildTarget("gad7", GAD7_ITEMS, core),
  };
}

function formatItems(specs: readonly ItemSpec[], target: SelfReportTarget): string {
  return specs
    .map((spec, i) => `  - ${spec.label}: ${FREQUENCY_LABELS[target.items[i] ?? 0]}`)
    .join("\n");
}

/** Patient prompt block (Module 1 fidelity). English instructions; the
 * patient still answers in the session language enforced by Module 3. */
export function formatSelfReportForPrompt(core: ClinicalCore): string {
  const profile = deriveSelfReportProfile(core);
  return [
    "SELF-REPORT QUESTIONNAIRES (only when the therapist administers them):",
    "- If the therapist asks you to complete the PHQ-9 or GAD-7, or asks how often over the last two weeks you have been bothered by one of these problems, answer consistently with the frequencies below.",
    "- Answer in everyday words in the session language. Give a number only if the therapist offers the 0 to 3 scale.",
    "- Never volunteer a questionnaire, a total score, or a severity label. You may hesitate or ask what a question means.",
    "- The question about being better off dead or hurting yourself follows Module 4 risk disclosure.",
    "PHQ-9, last two weeks:",
    formatItems(PHQ9_ITEMS, profile.phq9),
    "GAD-7, last two weeks:",
    formatItems(GAD7_ITEMS, profile.gad7),
  ].join("\n");
}

/** Standard published severity bands (Kroenke 2001; Spitzer 2006). */
export function severityBand(measure: "phq9" | "gad7", total: number): string {
  if (measure === "phq9") {
    if (total >= 20) return "severe";
    if (total >= 15) return "moderately_severe";
    if (total >= 10) return "moderate";
    if (total >= 5) return "mild";
    return "minimal";
  }
  if (total >= 15) return "severe";
  if (total >= 10) return "moderate";
  if (total >= 5) return "mild";
  return "minimal";
}
