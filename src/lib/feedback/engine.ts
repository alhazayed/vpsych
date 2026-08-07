import { randomUUID } from "node:crypto";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_ROLE_PERSONAS,
  FEEDBACK_SEVERITIES,
  type FeedbackSubmitInput,
  type InstitutionalFeedback,
} from "./types";
import { storeFeedback } from "./store";

const FORBIDDEN_META_KEYS = [
  "clinical_snapshot",
  "decision_plan",
  "case_memory",
  "patient_long_term_memory",
  "patient_decision_plan",
] as const;

function isRole(v: string): v is FeedbackSubmitInput["role_persona"] {
  return (FEEDBACK_ROLE_PERSONAS as readonly string[]).includes(v);
}
function isCategory(v: string): v is FeedbackSubmitInput["category"] {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(v);
}
function isSeverity(v: string): v is NonNullable<FeedbackSubmitInput["severity"]> {
  return (FEEDBACK_SEVERITIES as readonly string[]).includes(v);
}

export function sanitizeFeedbackMetadata(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if ((FORBIDDEN_META_KEYS as readonly string[]).includes(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v == null) {
      /* skip */
    } else {
      // Flatten unknown objects to string length only — never nest clinical blobs.
      out[k] = "[redacted-nonscalar]";
    }
  }
  return out;
}

export function validateFeedbackInput(input: FeedbackSubmitInput): string | null {
  if (!isRole(input.role_persona)) return "Invalid role_persona";
  if (!isCategory(input.category)) return "Invalid category";
  if (input.severity && !isSeverity(input.severity)) return "Invalid severity";
  const body = input.body?.trim() ?? "";
  if (body.length < 1 || body.length > 8000) return "body must be 1–8000 chars";
  if (
    input.rating != null &&
    (typeof input.rating !== "number" ||
      !Number.isFinite(input.rating) ||
      input.rating < 1 ||
      input.rating > 5)
  ) {
    return "rating must be 1–5";
  }
  return null;
}

export function createFeedbackRecord(
  input: FeedbackSubmitInput,
  submitterId: string | null,
): InstitutionalFeedback {
  const err = validateFeedbackInput(input);
  if (err) throw new Error(err);
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    submitter_id: submitterId,
    institution_id: input.institution_id ?? null,
    role_persona: input.role_persona,
    category: input.category,
    severity: input.severity ?? "medium",
    rating: input.rating ?? null,
    body: input.body.trim(),
    session_id: input.session_id ?? null,
    locale: input.locale ?? null,
    metadata: sanitizeFeedbackMetadata(input.metadata),
  };
}

/** Record feedback in process memory. DB persist is API best-effort. */
export function submitFeedback(
  input: FeedbackSubmitInput,
  submitterId: string | null,
): InstitutionalFeedback {
  const row = createFeedbackRecord(input, submitterId);
  storeFeedback(row);
  return row;
}
