/**
 * Content hashing for ledger integrity & snapshot fingerprints.
 */

import { createHash } from "crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashPayload(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export function hashText(text: string | null | undefined): string | null {
  if (text == null || text === "") return null;
  return sha256Hex(text);
}
