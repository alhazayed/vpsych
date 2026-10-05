/**
 * Request validation for supervisor-designed skill tests. Hand-written like
 * the other engine validators; the database CHECKs repeat the hard limits.
 */

import type { CaseDifficulty, CaseSeverity } from "@/lib/case-engine/types";
import type { SkillTestAssignment } from "@/lib/types";
import {
  CASE_DIFFICULTIES,
  CASE_SEVERITIES,
  MAX_SKILL_TEST_COMORBIDITIES,
  MAX_SKILL_TEST_SESSIONS,
  SKILL_TEST_LANGUAGES,
  isKnownDisorder,
  listAllowedComorbidities,
} from "./catalog";

export type SkillTestInput = {
  traineeId: string;
  avatarId: string;
  title: string;
  language: SkillTestAssignment["language"];
  disorderSlug: string;
  comorbiditySlugs: string[];
  difficulty: CaseDifficulty;
  severity: CaseSeverity | null;
  requiredSessions: number;
  traineeInstructions: string | null;
  dueAt: string | null;
};

export type SkillTestValidationError =
  | "trainee_required"
  | "patient_required"
  | "title_invalid"
  | "language_invalid"
  | "disorder_invalid"
  | "comorbidity_invalid"
  | "difficulty_invalid"
  | "severity_invalid"
  | "sessions_invalid"
  | "instructions_too_long"
  | "due_date_invalid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSkillTestInput(
  body: unknown,
  now: Date = new Date(),
):
  | { ok: true; value: SkillTestInput }
  | { ok: false; error: SkillTestValidationError } {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;

  if (!isUuid(b.traineeId)) return { ok: false, error: "trainee_required" };
  if (!isUuid(b.avatarId)) return { ok: false, error: "patient_required" };

  const title = str(b.title);
  if (title.length < 1 || title.length > 120) {
    return { ok: false, error: "title_invalid" };
  }

  const language = str(b.language);
  if (!(SKILL_TEST_LANGUAGES as readonly string[]).includes(language)) {
    return { ok: false, error: "language_invalid" };
  }

  const disorderSlug = str(b.disorderSlug);
  if (!isKnownDisorder(disorderSlug)) {
    return { ok: false, error: "disorder_invalid" };
  }

  const rawComorbidities = Array.isArray(b.comorbiditySlugs)
    ? b.comorbiditySlugs
    : [];
  const comorbiditySlugs = [
    ...new Set(rawComorbidities.map(str).filter(Boolean)),
  ];
  const allowed = new Set(listAllowedComorbidities(disorderSlug));
  if (
    comorbiditySlugs.length > MAX_SKILL_TEST_COMORBIDITIES ||
    comorbiditySlugs.some((s) => !allowed.has(s))
  ) {
    return { ok: false, error: "comorbidity_invalid" };
  }

  const difficulty = str(b.difficulty) as CaseDifficulty;
  if (!CASE_DIFFICULTIES.includes(difficulty)) {
    return { ok: false, error: "difficulty_invalid" };
  }

  const severityRaw = str(b.severity);
  const severity = severityRaw ? (severityRaw as CaseSeverity) : null;
  if (severity && !CASE_SEVERITIES.includes(severity)) {
    return { ok: false, error: "severity_invalid" };
  }

  const requiredSessions =
    typeof b.requiredSessions === "number"
      ? b.requiredSessions
      : Number.parseInt(str(b.requiredSessions), 10);
  if (
    !Number.isInteger(requiredSessions) ||
    requiredSessions < 1 ||
    requiredSessions > MAX_SKILL_TEST_SESSIONS
  ) {
    return { ok: false, error: "sessions_invalid" };
  }

  const instructions = str(b.traineeInstructions);
  if (instructions.length > 1000) {
    return { ok: false, error: "instructions_too_long" };
  }

  let dueAt: string | null = null;
  const dueRaw = str(b.dueAt);
  if (dueRaw) {
    const due = new Date(dueRaw);
    // A due date must be a real date that has not already passed (by day).
    if (
      Number.isNaN(due.getTime()) ||
      due.getTime() < now.getTime() - 24 * 60 * 60 * 1000
    ) {
      return { ok: false, error: "due_date_invalid" };
    }
    dueAt = due.toISOString();
  }

  return {
    ok: true,
    value: {
      traineeId: b.traineeId,
      avatarId: b.avatarId,
      title,
      language: language as SkillTestAssignment["language"],
      disorderSlug,
      comorbiditySlugs,
      difficulty,
      severity,
      requiredSessions,
      traineeInstructions: instructions || null,
      dueAt,
    },
  };
}
