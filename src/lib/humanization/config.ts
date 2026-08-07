/**
 * Mission 10 — Humanization Engine feature flag.
 *
 * Default ON when a clinical snapshot is present (training fidelity).
 * Set HUMANIZATION_ENABLED=false to disable.
 */

export function isHumanizationGloballyEnabled(): boolean {
  const raw = process.env.HUMANIZATION_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  // Explicit true or unset → enabled (Mission 10 default).
  return true;
}

export function isHumanizationEnabledForSession(opts: {
  hasClinicalSnapshot: boolean;
}): boolean {
  if (!isHumanizationGloballyEnabled()) return false;
  return opts.hasClinicalSnapshot;
}
