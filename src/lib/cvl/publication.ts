import type { CvlExportBundle } from "@/lib/cvl/export";
import { CFL_DEFINITIONS } from "@/lib/cvl/types";

/**
 * Publication-ready manuscript skeleton from real CVL exports only.
 * Empty results sections when data insufficient — never invents numbers.
 */
export function buildPublicationSkeleton(pkg: CvlExportBundle): {
  title: string;
  methods: string[];
  results: string[];
  tables: Array<{ id: string; caption: string; rows: string[][] }>;
  limitations: string[];
  consort_notes: string[];
} {
  const metricsTable = [
    ["Metric", "Score", "n", "CI95", "Insufficient?"],
    ...pkg.metrics.map((m) => [
      m.metric_id,
      m.score == null ? "—" : String(m.score),
      String(m.n),
      m.ci95 ? `${m.ci95.lower.toFixed(1)}–${m.ci95.upper.toFixed(1)}` : "—",
      m.insufficient_data ? "yes" : "no",
    ]),
  ];

  const cflTable = [
    ["Case", "Disorder", "CFL", "Definition"],
    ...pkg.cfl.map((c) => [
      c.case_ref,
      c.disorder_slug ?? "—",
      c.level,
      CFL_DEFINITIONS[c.level],
    ]),
  ];

  const hasResults = pkg.metrics.some((m) => !m.insufficient_data);
  return {
    title:
      "Blinded clinical validation of a psychiatric training simulator: protocol and interim results",
    methods: [
      "Design: multi-arm blinded rating studies (real patient / standardized patient / VPsych avatar) with opaque reviewer tokens.",
      "Reviewers: consultant psychiatrists, residents, clinical psychologists, CBT therapists, GPs, medical students as enrolled.",
      "Primary endpoints: Clinical Realism Index (CRI), Human Conversation Fidelity Index (HCFI), arm discrimination (guess).",
      "Secondary: Therapeutic Alliance Index, Educational Effectiveness Index, Clinical Fidelity Level (CFL-1…5).",
      "Statistics: means with 95% CI; Cohen's d for education arms; ICC approximation for multi-rater composites.",
      "Ethics: IRB reference stored per study; reviewer identities confidential; no marketing claims before thresholds.",
      `Software: VPsych CVL v${pkg.cvl_version}; export is_fabricated=${pkg.is_fabricated}.`,
    ],
    results: hasResults
      ? [
          `Studies registered: ${pkg.studies.length}. Redacted ratings: ${pkg.redacted_ratings_count}.`,
          `Inter-rater ICC: ${pkg.inter_rater.icc ?? "insufficient data"} (${pkg.inter_rater.note}).`,
          ...pkg.metrics
            .filter((m) => !m.insufficient_data)
            .map(
              (m) =>
                `${m.metric_id}=${m.score} (n=${m.n}${m.ci95 ? `, 95% CI ${m.ci95.lower.toFixed(1)}–${m.ci95.upper.toFixed(1)}` : ""}).`,
            ),
        ]
      : [
          "No adequate human ratings yet. Results section intentionally empty — do not fabricate interim numbers.",
          "Recruit reviewers and submit BPC/HCF forms before claiming realism.",
        ],
    tables: [
      { id: "T1", caption: "Validation metrics", rows: metricsTable },
      { id: "T2", caption: "Clinical Fidelity Levels", rows: cflTable },
    ],
    limitations: [
      "Until CFL-4/5 evidence accumulates, findings support technical/student believability only.",
      "Memory/DB fallback environments are not publication sources of record.",
      "Arabic/English bilingual analyses require locale-stratified HCF rows.",
    ],
    consort_notes: [
      "CONSORT-style flow: assessed for eligibility → randomized to arm (hidden) → rated → analyzed.",
      "Report exclusions for incomplete forms and persona_fallback sessions separately.",
      "Preregister primary endpoint and non-inferiority margin vs standardized patients before unblinding.",
    ],
  };
}
