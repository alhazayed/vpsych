/**
 * Phase 15 — Institutional pilot completion tracking (PHI-free).
 */

import type { PilotInstitution } from "@/lib/ops/cidp-pilot";
import { summarizePilotPortfolio } from "@/lib/ops/cidp-pilot";

export type PilotInstitutionExtended = PilotInstitution & {
  assessments_completed?: number;
  certifications_completed?: number;
  user_satisfaction?: number;
  faculty_satisfaction?: number;
  operational_incidents?: number;
  feature_requests?: number;
  onboarding_complete?: boolean;
};

export type PilotCompletionReport = {
  generated_at: string;
  institutions: number;
  onboarding_complete: number;
  active_institutions: number;
  total_active_users: number;
  total_faculty: number;
  total_residents: number;
  simulations_completed: number;
  assessments_completed: number;
  certifications_completed: number;
  mean_user_satisfaction: number;
  mean_faculty_satisfaction: number;
  operational_incidents: number;
  feature_requests: number;
  objectives_met: boolean;
  longitudinal: Array<{
    id: string;
    institution_name: string;
    status: string;
    simulations_completed: number;
    assessments_completed: number;
    certifications_completed: number;
    user_satisfaction: number;
    operational_incidents: number;
  }>;
  notes: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function buildPilotCompletionReport(
  pilots: PilotInstitutionExtended[],
): PilotCompletionReport {
  const portfolio = summarizePilotPortfolio(pilots);
  let assessments = 0;
  let certs = 0;
  let satSum = 0;
  let facSatSum = 0;
  let satN = 0;
  let facN = 0;
  let incidents = 0;
  let features = 0;
  let onboarding = 0;

  const longitudinal = pilots.map((p) => {
    const a = p.assessments_completed ?? p.simulations_completed;
    const c = p.certifications_completed ?? 0;
    const us = clamp01(p.user_satisfaction ?? 0);
    const fs = clamp01(p.faculty_satisfaction ?? 0);
    assessments += a;
    certs += c;
    if (p.user_satisfaction !== undefined) {
      satSum += us;
      satN += 1;
    }
    if (p.faculty_satisfaction !== undefined) {
      facSatSum += fs;
      facN += 1;
    }
    incidents += p.operational_incidents ?? p.critical_incidents;
    features += p.feature_requests ?? 0;
    if (p.onboarding_complete || p.status !== "planned") onboarding += 1;

    return {
      id: p.id,
      institution_name: p.institution_name,
      status: p.status,
      simulations_completed: p.simulations_completed,
      assessments_completed: a,
      certifications_completed: c,
      user_satisfaction: Math.round(us * 1000) / 10,
      operational_incidents: p.operational_incidents ?? p.critical_incidents,
    };
  });

  const active = portfolio.by_status.active ?? 0;
  const observation = portfolio.by_status.observation ?? 0;
  const completed = portfolio.by_status.completed ?? 0;
  const active_institutions = active + observation + completed;

  const objectives_met =
    pilots.length > 0 &&
    active_institutions >= 1 &&
    portfolio.total_critical_incidents_open === 0 &&
    portfolio.mean_training_completion_rate >= 70 &&
    (satN === 0 || satSum / satN >= 0.7);

  return {
    generated_at: new Date().toISOString(),
    institutions: pilots.length,
    onboarding_complete: onboarding,
    active_institutions,
    total_active_users:
      portfolio.total_residents_active + portfolio.total_faculty_active,
    total_faculty: portfolio.total_faculty_active,
    total_residents: portfolio.total_residents_active,
    simulations_completed: pilots.reduce(
      (s, p) => s + p.simulations_completed,
      0,
    ),
    assessments_completed: assessments,
    certifications_completed: certs,
    mean_user_satisfaction:
      satN === 0 ? 0 : Math.round((satSum / satN) * 1000) / 10,
    mean_faculty_satisfaction:
      facN === 0 ? 0 : Math.round((facSatSum / facN) * 1000) / 10,
    operational_incidents: incidents,
    feature_requests: features,
    objectives_met,
    longitudinal,
    notes: [
      "PHI-free institutional aggregates only.",
      pilots.length === 0
        ? "No pilots registered — objectives_met=false; GA pilot gate remains OPEN."
        : objectives_met
          ? "Pilot objectives met under Phase 15 thresholds."
          : "Pilot objectives not yet met — continue CIDP observation.",
    ],
  };
}
