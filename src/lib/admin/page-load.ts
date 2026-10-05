/**
 * Detail pages used to treat any failed read as "not found", so a database
 * outage rendered a 404. Only a malformed id (Postgres invalid_text_representation,
 * e.g. a non-UUID in the URL) is a genuine not-found; anything else should reach
 * the error boundary, which offers a retry and shows a reference digest.
 */

import { notFound } from "next/navigation";

type LoadError = { code?: string | null; message?: string | null } | null | undefined;

export function classifyLoadError(error: LoadError): "not_found" | "failed" | null {
  if (!error) return null;
  return error.code === "22P02" ? "not_found" : "failed";
}

/** Calls `notFound()` for a malformed id and throws for any other read error. */
export function throwOnLoadError(error: LoadError, context: string): void {
  const kind = classifyLoadError(error);
  if (kind === "not_found") notFound();
  if (kind === "failed") {
    console.warn(`[${context}] load failed:`, error?.message ?? "unknown");
    throw new Error(`${context}: load failed`);
  }
}
