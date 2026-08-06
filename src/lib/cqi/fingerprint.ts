import { createHash } from "crypto";
import type { CqiCategory, CqiSeverity } from "@/lib/cqi/types";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "is",
  "it",
  "this",
  "that",
  "was",
  "were",
  "with",
  "for",
  "on",
  "as",
  "at",
  "be",
  "by",
  "from",
  "not",
  "patient",
  "feels",
  "seemed",
  "very",
  "really",
]);

/** Normalize free text into stable tokens for clustering. */
export function tokenizeIssue(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 24);
}

export function buildFingerprint(input: {
  category: CqiCategory;
  severity: CqiSeverity;
  free_text: string;
  disorder_slug?: string | null;
  language?: string | null;
}): string {
  const tokens = tokenizeIssue(input.free_text).sort().slice(0, 12);
  const raw = [
    input.category,
    input.severity === "suggestion" ? "low" : input.severity,
    input.disorder_slug ?? "*",
    (input.language ?? "*").slice(0, 5),
    tokens.join("|"),
  ].join("::");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function contentHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 40);
}
