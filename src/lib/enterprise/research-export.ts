/**
 * Research-ready anonymous export helpers.
 */

import { createHash } from "node:crypto";

export type ResearchExportOptions = {
  /** Salt for irreversible subject hashing (institution research key). */
  salt: string;
  /** Content/schema version lock string (e.g. case engine + graph versions). */
  version_lock: string;
  include_competency_scores?: boolean;
  include_timestamps?: boolean;
};

export type ResearchSessionRow = {
  subject_id: string;
  session_ordinal: number;
  locale: string | null;
  difficulty: string | null;
  primary_diagnosis_slug: string | null;
  overall_score: number | null;
  competency_scores?: Record<string, number>;
  started_at?: string | null;
  ended_at?: string | null;
  template_slug?: string | null;
  preset_slug?: string | null;
};

export type IdentifiedSessionInput = {
  user_id: string;
  session_id: string;
  locale?: string | null;
  difficulty?: string | null;
  primary_diagnosis_slug?: string | null;
  overall_score?: number | null;
  competency_scores?: Record<string, number>;
  started_at?: string | null;
  ended_at?: string | null;
  template_slug?: string | null;
  preset_slug?: string | null;
};

export function anonymizeSubjectId(userId: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${userId}`)
    .digest("hex")
    .slice(0, 24);
}

export function buildAnonymousResearchExport(
  rows: IdentifiedSessionInput[],
  opts: ResearchExportOptions,
): {
  version_lock: string;
  generated_at: string;
  row_count: number;
  reproducible: true;
  rows: ResearchSessionRow[];
} {
  // Stable ordinals per subject for longitudinal analysis without timestamps if stripped
  const ordinals = new Map<string, number>();
  const sorted = [...rows].sort((a, b) => {
    const ta = a.started_at ?? a.session_id;
    const tb = b.started_at ?? b.session_id;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  const out: ResearchSessionRow[] = sorted.map((r) => {
    const subject = anonymizeSubjectId(r.user_id, opts.salt);
    const n = (ordinals.get(subject) ?? 0) + 1;
    ordinals.set(subject, n);
    const row: ResearchSessionRow = {
      subject_id: subject,
      session_ordinal: n,
      locale: r.locale ?? null,
      difficulty: r.difficulty ?? null,
      primary_diagnosis_slug: r.primary_diagnosis_slug ?? null,
      overall_score: r.overall_score ?? null,
      template_slug: r.template_slug ?? null,
      preset_slug: r.preset_slug ?? null,
    };
    if (opts.include_competency_scores && r.competency_scores) {
      row.competency_scores = { ...r.competency_scores };
    }
    if (opts.include_timestamps) {
      row.started_at = r.started_at ?? null;
      row.ended_at = r.ended_at ?? null;
    }
    return row;
  });

  return {
    version_lock: opts.version_lock,
    generated_at: new Date().toISOString(),
    row_count: out.length,
    reproducible: true,
    rows: out,
  };
}

/** Ensure export contains no raw PII fields. */
export function assertNoPiiKeys(obj: unknown): string[] {
  const forbidden = [
    "email",
    "display_name",
    "user_id",
    "therapist_id",
    "full_name",
    "phone",
    "address",
  ];
  const found: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        const p = path ? `${path}.${k}` : k;
        if (forbidden.includes(k)) found.push(p);
        walk(child, p);
      }
    }
  };
  walk(obj, "");
  return found;
}
