/**
 * CIDP pilot institution tracking — ops/enterprise owned.
 * Aggregates observational pilot KPIs. No PHI / no clinical writes.
 */

export const PILOT_STATUSES = [
  "planned",
  "onboarding",
  "active",
  "observation",
  "paused",
  "completed",
  "withdrawn",
] as const;

export type PilotStatus = (typeof PILOT_STATUSES)[number];

export type PilotInstitution = {
  id: string;
  institution_name: string;
  institution_type:
    | "university"
    | "residency"
    | "teaching_hospital"
    | "mental_health_center"
    | "research";
  department?: string;
  campus?: string;
  status: PilotStatus;
  start_date: string;
  observation_end_date?: string | null;
  residents_invited: number;
  residents_active: number;
  faculty_active: number;
  simulations_completed: number;
  support_requests: number;
  critical_incidents: number;
  configuration_issues: number;
  research_participating: boolean;
  training_completion_rate: number;
  notes?: string;
};

export type PilotPortfolioSummary = {
  generated_at: string;
  pilots: number;
  by_status: Record<string, number>;
  deployment_success_rate: number;
  total_residents_active: number;
  total_faculty_active: number;
  total_critical_incidents_open: number;
  research_participating_orgs: number;
  mean_training_completion_rate: number;
  items: Array<{
    id: string;
    institution_name: string;
    status: PilotStatus;
    training_completion_rate: number;
    critical_incidents: number;
  }>;
};

export function summarizePilotPortfolio(
  pilots: PilotInstitution[],
): PilotPortfolioSummary {
  const by_status: Record<string, number> = {};
  let residents = 0;
  let faculty = 0;
  let critical = 0;
  let research = 0;
  let trainingSum = 0;
  let deployedOk = 0;

  for (const p of pilots) {
    by_status[p.status] = (by_status[p.status] ?? 0) + 1;
    residents += p.residents_active;
    faculty += p.faculty_active;
    critical += p.critical_incidents;
    if (p.research_participating) research += 1;
    trainingSum += clamp01(p.training_completion_rate);
    if (
      p.status === "active" ||
      p.status === "observation" ||
      p.status === "completed"
    ) {
      deployedOk += 1;
    }
  }

  const n = pilots.length;
  return {
    generated_at: new Date().toISOString(),
    pilots: n,
    by_status,
    deployment_success_rate: n === 0 ? 0 : round1((deployedOk / n) * 100),
    total_residents_active: residents,
    total_faculty_active: faculty,
    total_critical_incidents_open: critical,
    research_participating_orgs: research,
    mean_training_completion_rate:
      n === 0 ? 0 : round1((trainingSum / n) * 100),
    items: pilots.map((p) => ({
      id: p.id,
      institution_name: p.institution_name,
      status: p.status,
      training_completion_rate: round1(clamp01(p.training_completion_rate) * 100),
      critical_incidents: p.critical_incidents,
    })),
  };
}

/** Seed empty portfolio for dashboards when no registry rows yet. */
export function emptyPilotPortfolio(): PilotPortfolioSummary {
  return summarizePilotPortfolio([]);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
