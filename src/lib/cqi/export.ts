/**
 * Research-mode export — anonymized by default.
 */

import type { CqiFlagRow } from "@/lib/cqi/types";
import type { AnalystReport } from "@/lib/cqi/analyst";

export type CqiExportPackage = {
  format: "research_package";
  generated_at: string;
  anonymized: true;
  n_flags: number;
  flags: Array<Record<string, unknown>>;
  analyst: AnalystReport | null;
};

/** Strip reviewer identity and raw PHI-ish free text option. */
export function anonymizeFlag(
  f: CqiFlagRow,
  opts?: { redact_free_text?: boolean },
): Record<string, unknown> {
  return {
    id: f.id,
    created_at: f.created_at,
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    free_text: opts?.redact_free_text
      ? "[redacted]"
      : f.free_text,
    suggested_improvement: f.suggested_improvement,
    expected_behaviour: f.expected_behaviour,
    reduces_educational_quality: f.reduces_educational_quality,
    usable_in_residency: f.usable_in_residency,
    scores: f.scores,
    would_recommend: f.would_recommend,
    status: f.status,
    fingerprint: f.fingerprint,
    platform_version: f.platform_version,
    release_version: f.release_version,
    prompt_version: f.prompt_version,
    pme_version: f.pme_version,
    disorder_slug: f.disorder_slug,
    language: f.language,
    annotation_count: f.annotations?.length ?? 0,
    transcript_turns: f.transcript_window?.length ?? 0,
    anonymous: true,
    reviewer_id: null,
  };
}

export function buildResearchPackage(
  flags: CqiFlagRow[],
  analyst: AnalystReport | null,
  opts?: { redact_free_text?: boolean },
): CqiExportPackage {
  return {
    format: "research_package",
    generated_at: new Date().toISOString(),
    anonymized: true,
    n_flags: flags.length,
    flags: flags.map((f) => anonymizeFlag(f, opts)),
    analyst,
  };
}

export function flagsToCsv(rows: Array<Record<string, unknown>>): string {
  const cols = [
    "id",
    "created_at",
    "category",
    "severity",
    "confidence",
    "disorder_slug",
    "language",
    "prompt_version",
    "release_version",
    "status",
    "fingerprint",
    "reduces_educational_quality",
    "usable_in_residency",
    "would_recommend",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => esc(r[c])).join(","));
  }
  return lines.join("\n");
}
