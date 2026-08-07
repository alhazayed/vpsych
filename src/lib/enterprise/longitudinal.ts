/**
 * Longitudinal enterprise tracking — residency, board prep, CME, lifetime.
 * Observational aggregates over ACE/Education/Supervisor signals.
 */

import type { LongitudinalTrack } from "@/lib/enterprise/types";

export function buildLongitudinalTrack(input: {
  user_id: string;
  organization_id: string;
  horizon: LongitudinalTrack["horizon"];
  session_count?: number;
  overall_ema?: number;
  milestones?: LongitudinalTrack["milestones"];
}): LongitudinalTrack {
  const session_count = input.session_count ?? 0;
  const overall_ema = input.overall_ema ?? 0;
  const milestones =
    input.milestones ?? defaultMilestones(input.horizon, session_count, overall_ema);

  return {
    user_id: input.user_id,
    organization_id: input.organization_id,
    horizon: input.horizon,
    milestones,
    session_count,
    overall_ema,
  };
}

function defaultMilestones(
  horizon: LongitudinalTrack["horizon"],
  sessions: number,
  ema: number,
): LongitudinalTrack["milestones"] {
  const now = new Date().toISOString();
  switch (horizon) {
    case "residency":
      return [
        {
          id: "pgy1_intake",
          label: "PGY-1 intake simulations",
          at: now,
          status: sessions >= 5 ? "met" : "pending",
        },
        {
          id: "mid_residency",
          label: "Mid-residency competency floor",
          at: now,
          status: sessions >= 25 && ema >= 70 ? "met" : "pending",
        },
        {
          id: "chief_readiness",
          label: "Senior readiness",
          at: now,
          status: sessions >= 50 && ema >= 75 ? "met" : "pending",
        },
      ];
    case "board_prep":
      return [
        {
          id: "board_volume",
          label: "Board prep volume",
          at: now,
          status: sessions >= 40 ? "met" : "pending",
        },
        {
          id: "board_floor",
          label: "Formative score floor 75",
          at: now,
          status: ema >= 75 ? "met" : "pending",
        },
      ];
    case "cme":
      return [
        {
          id: "cme_hours",
          label: "CME simulation hours proxy",
          at: now,
          status: sessions >= 10 ? "met" : "pending",
        },
      ];
    case "faculty_dev":
      return [
        {
          id: "faculty_obs",
          label: "Observed teaching simulations",
          at: now,
          status: sessions >= 8 ? "met" : "pending",
        },
      ];
    case "lifetime":
      return [
        {
          id: "lifetime_100",
          label: "100 lifetime sessions",
          at: now,
          status: sessions >= 100 ? "met" : "pending",
        },
      ];
    case "years":
      return [
        {
          id: "year_gate",
          label: "Annual formative review",
          at: now,
          status: sessions >= 20 ? "met" : "pending",
        },
      ];
    case "months":
    default:
      return [
        {
          id: "month_gate",
          label: "Monthly practice volume",
          at: now,
          status: sessions >= 4 ? "met" : "pending",
        },
      ];
  }
}
