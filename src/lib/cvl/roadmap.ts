import type { CvlMetricResult, CvlRoadmapItem } from "@/lib/cvl/types";

/** Turn validation gaps into prioritized remediation recommendations. */
export function buildValidationRoadmap(
  metrics: CvlMetricResult[],
): CvlRoadmapItem[] {
  const items: CvlRoadmapItem[] = [];
  const byId = new Map(metrics.map((m) => [m.metric_id, m]));

  const pushGap = (
    metricId: string,
    title: string,
    effort: CvlRoadmapItem["implementation_effort"],
    fidelity: string,
  ) => {
    const m = byId.get(metricId as CvlMetricResult["metric_id"]);
    if (!m) return;
    if (m.insufficient_data) {
      items.push({
        priority: "p0",
        title: `Collect human data for ${metricId}`,
        educational_impact: "High — unlocks educational claims",
        clinical_impact: "High — required for CFL advancement",
        research_impact: "Critical — publication endpoint",
        implementation_effort: "s",
        expected_fidelity_improvement: "Enables measurement; no score change until data exists",
        evidence_refs: m.evidence_refs,
      });
      return;
    }
    if ((m.score ?? 100) < 70) {
      items.push({
        priority: (m.score ?? 0) < 55 ? "p0" : "p1",
        title,
        educational_impact: "High",
        clinical_impact: "High",
        research_impact: "High",
        implementation_effort: effort,
        expected_fidelity_improvement: fidelity,
        evidence_refs: m.evidence_refs,
      });
    }
  };

  pushGap(
    "CRI",
    "Improve clinical realism phenotype (Module 1 speech + disclosure)",
    "m",
    "+5–15 CRI after targeted disorder packages",
  );
  pushGap(
    "HCFI",
    "Improve human conversation fidelity (tempo, repair, affect)",
    "m",
    "+5–12 HCFI",
  );
  pushGap(
    "TAI",
    "Strengthen alliance-reactive patient behaviour",
    "m",
    "+alliance ratings in BPC",
  );
  pushGap(
    "EEI",
    "Run resident education RCT arm with OSCE endpoints",
    "l",
    "Unlocks EEI + CFL-5 pathway",
  );
  pushGap(
    "LCI",
    "Instrument longitudinal sessions 1–10 measures",
    "m",
    "Enables LCI trajectory claims",
  );
  pushGap(
    "DFI",
    "Tighten diagnostic consistency / syndrome authority",
    "s",
    "+DFI via catalog + override strip",
  );

  if (!items.length) {
    items.push({
      priority: "p2",
      title: "Scale blinded reviewer recruitment",
      educational_impact: "Moderate",
      clinical_impact: "Moderate",
      research_impact: "High — tighter CIs and ICC",
      implementation_effort: "s",
      expected_fidelity_improvement: "Precision, not mean shift",
      evidence_refs: [],
    });
  }

  return items.sort((a, b) => a.priority.localeCompare(b.priority));
}
