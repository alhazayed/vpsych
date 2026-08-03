/**
 * Scalability readiness model for institutional deployment sizes.
 */

export type ScaleTier = "100" | "1000" | "10000" | "multi_institution" | "multi_country";

export type ScaleAssessment = {
  tier: ScaleTier;
  ready: boolean;
  score: number;
  blockers: string[];
  notes: string[];
};

export function assessScaleTier(input: {
  rateLimitConfigured: boolean;
  upstashConfigured: boolean;
  tenantIsolation: boolean;
  pagination: boolean;
  indexesPresent: boolean;
  multiInstanceSafe: boolean;
}): Record<ScaleTier, ScaleAssessment> {
  const baseNotes = [
    input.rateLimitConfigured
      ? "API rate limits present"
      : "Rate limits missing",
    input.upstashConfigured
      ? "Upstash available for multi-instance limits"
      : "In-memory rate limit fallback — not multi-instance safe",
    input.tenantIsolation
      ? "Institution tenant isolation modeled"
      : "No tenant isolation",
    input.pagination
      ? "Cursor/offset pagination available"
      : "Hard .limit caps only — improve before 10k",
    input.indexesPresent ? "Key FK/institution indexes present" : "Missing indexes",
  ];

  const mk = (
    tier: ScaleTier,
    score: number,
    blockers: string[],
  ): ScaleAssessment => ({
    tier,
    ready: blockers.length === 0 && score >= 70,
    score,
    blockers,
    notes: baseNotes,
  });

  const t100 = mk(
    "100",
    input.rateLimitConfigured && input.indexesPresent ? 92 : 70,
    [],
  );

  const t1000Blockers: string[] = [];
  if (!input.tenantIsolation) t1000Blockers.push("tenant_isolation");
  if (!input.rateLimitConfigured) t1000Blockers.push("rate_limits");
  const t1000 = mk(
    "1000",
    t1000Blockers.length ? 62 : input.upstashConfigured ? 88 : 78,
    t1000Blockers,
  );

  const t10kBlockers: string[] = [...t1000Blockers];
  if (!input.pagination) t10kBlockers.push("pagination");
  if (!input.multiInstanceSafe) t10kBlockers.push("multi_instance_rate_limits");
  const t10k = mk(
    "10000",
    t10kBlockers.length ? 55 : 82,
    t10kBlockers,
  );

  const multiInstBlockers = input.tenantIsolation ? [] : ["tenant_isolation"];
  const multiInst = mk(
    "multi_institution",
    input.tenantIsolation ? 85 : 40,
    multiInstBlockers,
  );

  const multiCountryBlockers = [
    ...multiInstBlockers,
    ...(input.pagination ? [] : ["pagination"]),
  ];
  const multiCountry = mk(
    "multi_country",
    multiCountryBlockers.length ? 58 : 80,
    multiCountryBlockers,
  );

  return {
    "100": t100,
    "1000": t1000,
    "10000": t10k,
    multi_institution: multiInst,
    multi_country: multiCountry,
  };
}
