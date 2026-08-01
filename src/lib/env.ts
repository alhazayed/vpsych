/**
 * Shared helpers for treating environment secrets as "configured".
 * Rejects empty values and common placeholders so a local AI_GATEWAY_API_KEY=test
 * does not route traffic to a dead gateway and surface as 502s.
 */

const PLACEHOLDER_VALUES = new Set([
  "",
  "test",
  "testing",
  "changeme",
  "change-me",
  "your-key",
  "your_key",
  "your-api-key",
  "xxx",
  "todo",
  "placeholder",
  "example",
]);

export function isConfiguredSecret(value?: string | null): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return false;
  if (/^(your[-_]|<.*>|\$\{)/i.test(trimmed)) return false;
  // Require a minimal length so "x" / "demo" don't count.
  return trimmed.length >= 8;
}
