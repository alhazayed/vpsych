/**
 * Analytics dashboards — Stage 10.
 * Aggregates observational KPIs only. Never reads session_reports narrative
 * for therapist-facing scopes; never invents clinical scores.
 */

import type {
  AnalyticsDashboard,
  AnalyticsScope,
} from "@/lib/enterprise/types";

export type AnalyticsInput = {
  organization_id: string;
  scope: AnalyticsScope;
  session_count?: number;
  active_learners?: number;
  mean_overall?: number;
  completion_rate?: number;
  certificate_count?: number;
  faculty_count?: number;
  program_count?: number;
  research_exports?: number;
  history?: Array<{ t: string; v: number }>;
};

export function buildAnalyticsDashboard(input: AnalyticsInput): AnalyticsDashboard {
  const session_count = input.session_count ?? 0;
  const active_learners = input.active_learners ?? 0;
  const mean_overall = input.mean_overall ?? 0;
  const completion_rate = input.completion_rate ?? 0;

  const kpis = baseKpis(input.scope, {
    session_count,
    active_learners,
    mean_overall,
    completion_rate,
    certificate_count: input.certificate_count ?? 0,
    faculty_count: input.faculty_count ?? 0,
    program_count: input.program_count ?? 0,
    research_exports: input.research_exports ?? 0,
  });

  return {
    scope: input.scope,
    organization_id: input.organization_id,
    generated_at: new Date().toISOString(),
    kpis,
    series: [
      {
        id: "overall_trend",
        label: "Formative overall EMA",
        points: input.history ?? [],
      },
    ],
    notes: [
      "Formative educational analytics only — competency scores are not validated clinical instruments.",
      "Tenant-scoped: no cross-organization aggregation except executive platform views.",
    ],
  };
}

function baseKpis(
  scope: AnalyticsScope,
  v: {
    session_count: number;
    active_learners: number;
    mean_overall: number;
    completion_rate: number;
    certificate_count: number;
    faculty_count: number;
    program_count: number;
    research_exports: number;
  },
): AnalyticsDashboard["kpis"] {
  const common = [
    { id: "sessions", label: "Sessions", value: v.session_count },
    { id: "learners", label: "Active learners", value: v.active_learners },
    {
      id: "mean_overall",
      label: "Mean formative overall",
      value: Math.round(v.mean_overall * 10) / 10,
    },
    {
      id: "completion",
      label: "Completion rate",
      value: Math.round(v.completion_rate * 1000) / 10,
      unit: "%",
    },
  ];

  switch (scope) {
    case "executive":
      return [
        ...common,
        { id: "programs", label: "Programs", value: v.program_count },
        { id: "faculty", label: "Faculty", value: v.faculty_count },
        { id: "certs", label: "Certificates issued", value: v.certificate_count },
      ];
    case "research":
      return [
        ...common,
        {
          id: "exports",
          label: "Research exports",
          value: v.research_exports,
        },
      ];
    case "faculty":
    case "supervisor":
      return [
        ...common,
        { id: "certs", label: "Certificates issued", value: v.certificate_count },
      ];
    default:
      return common;
  }
}

export const ANALYTICS_SCOPES: readonly AnalyticsScope[] = [
  "organization",
  "program",
  "department",
  "faculty",
  "resident",
  "student",
  "supervisor",
  "research",
  "executive",
] as const;
