/**
 * De-identification helpers for publication-ready exports.
 */

import { createHash } from "node:crypto";
import type { DeidentifyLevel } from "./types";

export function stablePseudonym(id: string, salt = "cvp-v1"): string {
  return createHash("sha256")
    .update(`${salt}:${id}`)
    .digest("hex")
    .slice(0, 12);
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;

export function scrubFreeText(
  text: string | null | undefined,
  level: DeidentifyLevel,
): string | null {
  if (text == null) return null;
  if (level === "none") return text;
  let out = text.replace(EMAIL_RE, "[REDACTED_EMAIL]").replace(PHONE_RE, "[REDACTED_PHONE]");
  if (level === "strict") {
    // Collapse potential proper-name patterns after "Dr." / names in quotes lightly
    out = out.replace(/\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, "Dr. [REDACTED]");
  }
  return out;
}

export type DeidentifiedRatingRow = {
  study_pseudonym: string;
  session_pseudonym: string;
  rater_pseudonym: string;
  institution_pseudonym: string | null;
  clinical_realism: number | null;
  educational_value: number | null;
  conversation_naturalness: number | null;
  therapeutic_alliance: number | null;
  patient_believability: number | null;
  learning_impact: number | null;
  voice_realism: number | null;
  arabic_quality: number | null;
  english_quality: number | null;
  free_text: string | null;
  created_at: string | null;
};

export function deidentifyRatingRow(
  row: {
    study_id: string;
    session_id: string;
    reviewer_id: string;
    institution_id?: string | null;
    clinical_realism?: number | null;
    educational_value?: number | null;
    conversation_naturalness?: number | null;
    therapeutic_alliance?: number | null;
    patient_believability?: number | null;
    learning_impact?: number | null;
    voice_realism?: number | null;
    arabic_quality?: number | null;
    english_quality?: number | null;
    free_text?: string | null;
    created_at?: string | null;
  },
  level: DeidentifyLevel,
): DeidentifiedRatingRow {
  return {
    study_pseudonym: stablePseudonym(row.study_id),
    session_pseudonym: stablePseudonym(row.session_id),
    rater_pseudonym: stablePseudonym(row.reviewer_id),
    institution_pseudonym: row.institution_id
      ? stablePseudonym(row.institution_id)
      : null,
    clinical_realism: row.clinical_realism ?? null,
    educational_value: row.educational_value ?? null,
    conversation_naturalness: row.conversation_naturalness ?? null,
    therapeutic_alliance: row.therapeutic_alliance ?? null,
    patient_believability: row.patient_believability ?? null,
    learning_impact: row.learning_impact ?? null,
    voice_realism: row.voice_realism ?? null,
    arabic_quality: row.arabic_quality ?? null,
    english_quality: row.english_quality ?? null,
    free_text: scrubFreeText(row.free_text, level),
    created_at: level === "strict" ? null : (row.created_at ?? null),
  };
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\n");
}
