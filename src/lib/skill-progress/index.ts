/**
 * Skill progress — session-by-session rubric scores for one trainee or one
 * therapy course, read from the reports that already exist.
 *
 * Pure presentation shaping: no new scoring, no second formula. Item scores
 * are rescaled to 0–100 so every skill shares one axis; the overall score is
 * the report's own `overall`. Heuristic-fallback reports (no model examiner)
 * are left out of the trend and counted instead. Admin-only, like the
 * reports it reads. Scores are not validated.
 */
import { localizeRubricLabel } from "@/lib/ai/report-locale";

/** Canonical rubric order (`defaultRubric` in lib/ai/assessment.ts). */
export const SKILL_ORDER = [
  "alliance",
  "assessment",
  "dsm_reasoning",
  "icd_reasoning",
  "clinical_formulation",
  "differential_diagnosis",
  "risk_formulation",
  "educational_competency",
  "interventions",
  "safety",
  "structure",
] as const;

/** Most recent sessions kept on a chart. */
export const MAX_PROGRESS_SESSIONS = 20;

export type ProgressSessionInput = {
  id: string;
  started_at: string;
  course_session_number?: number | null;
  /** `session_reports` embed: one row, an array of rows, or nothing. */
  session_reports?: unknown;
};

export type ProgressPoint = {
  sessionId: string;
  startedAt: string;
  /** Visit number inside a course, else the position in this series (1-based). */
  sessionNumber: number;
  overall: number | null;
};

export type SkillSeries = {
  id: string;
  label: string;
  /** One value per point (0–100), null where the report has no such item. */
  values: Array<number | null>;
  first: number | null;
  latest: number | null;
  /** latest − first, when both exist and differ in session. */
  change: number | null;
};

export type SkillProgress = {
  points: ProgressPoint[];
  overall: SkillSeries;
  skills: SkillSeries[];
  /** Reports scored by the heuristic fallback, left out of the trend. */
  excludedFallback: number;
  /** Older scored sessions beyond MAX_PROGRESS_SESSIONS, not drawn. */
  truncated: number;
};

type ReportScores = {
  overall?: unknown;
  items?: unknown;
  scientific_provenance?: { assessment_mode?: unknown } | null;
};

function firstReport(embed: unknown): { scores?: ReportScores | null } | null {
  if (Array.isArray(embed)) return (embed[0] as { scores?: ReportScores }) ?? null;
  if (embed && typeof embed === "object") return embed as { scores?: ReportScores };
  return null;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function series(
  id: string,
  label: string,
  values: Array<number | null>,
): SkillSeries {
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null);
  const first = present[0] ?? null;
  const last = present.at(-1) ?? null;
  return {
    id,
    label,
    values,
    first: first?.v ?? null,
    latest: last?.v ?? null,
    change: first && last && last.i > first.i ? last.v - first.v : null,
  };
}

export function buildSkillProgress(
  sessions: ProgressSessionInput[],
  opts: { language: "en" | "ar"; overallLabel: string; limit?: number },
): SkillProgress {
  const limit = opts.limit ?? MAX_PROGRESS_SESSIONS;
  let excludedFallback = 0;
  const scored: Array<{
    s: ProgressSessionInput;
    overall: number | null;
    items: Map<string, { pct: number; label: string }>;
  }> = [];

  const chronological = [...sessions].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  );
  for (const s of chronological) {
    const scores = firstReport(s.session_reports)?.scores;
    if (!scores || typeof scores !== "object") continue;
    if (scores.scientific_provenance?.assessment_mode === "heuristic_fallback") {
      excludedFallback += 1;
      continue;
    }
    const items = new Map<string, { pct: number; label: string }>();
    if (Array.isArray(scores.items)) {
      for (const raw of scores.items as Array<Record<string, unknown>>) {
        if (!raw || typeof raw.id !== "string") continue;
        if (!finite(raw.score) || !finite(raw.max) || raw.max <= 0) continue;
        items.set(raw.id, {
          pct: clampPct((raw.score / raw.max) * 100),
          label: typeof raw.label === "string" ? raw.label : raw.id,
        });
      }
    }
    const overall = finite(scores.overall) ? clampPct(scores.overall) : null;
    if (overall == null && items.size === 0) continue;
    scored.push({ s, overall, items });
  }

  const truncated = Math.max(0, scored.length - limit);
  const kept = scored.slice(truncated);

  const points: ProgressPoint[] = kept.map((k, i) => ({
    sessionId: k.s.id,
    startedAt: k.s.started_at,
    sessionNumber: k.s.course_session_number ?? truncated + i + 1,
    overall: k.overall,
  }));

  // Canonical skills first, then any custom rubric ids, in first-seen order.
  const ids: string[] = [];
  const fallbackLabels = new Map<string, string>();
  for (const k of kept) {
    for (const [id, item] of k.items) {
      if (!fallbackLabels.has(id)) fallbackLabels.set(id, item.label);
    }
  }
  for (const id of SKILL_ORDER) if (fallbackLabels.has(id)) ids.push(id);
  for (const id of fallbackLabels.keys()) if (!ids.includes(id)) ids.push(id);

  return {
    points,
    overall: series(
      "overall",
      opts.overallLabel,
      kept.map((k) => k.overall),
    ),
    skills: ids.map((id) =>
      series(
        id,
        localizeRubricLabel(id, fallbackLabels.get(id) ?? id, opts.language),
        kept.map((k) => k.items.get(id)?.pct ?? null),
      ),
    ),
    excludedFallback,
    truncated,
  };
}
