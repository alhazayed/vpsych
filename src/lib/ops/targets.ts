/**
 * Operational targets — RTO/RPO, severity, dependency inventory.
 * Not a substitute for platform (Supabase/Vercel) console configuration.
 */

export type DependencyId =
  | "vercel"
  | "supabase"
  | "openai"
  | "elevenlabs"
  | "upstash"
  | "database";

export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";

/** Recovery objectives for institutional simulation deployments. */
export const RECOVERY_OBJECTIVES = {
  /** Maximum acceptable data loss (hours) — assumes Supabase daily backup / PITR. */
  rpoHours: 24,
  /** Target time to restore service after declared disaster (hours). */
  rtoHours: 4,
  /** Soft target for vendor outage degrade path (seconds). */
  vendorDegradeSeconds: 30,
  /** Health probe timeout budget (ms). */
  healthProbeTimeoutMs: 5_000,
} as const;

export const DEPENDENCIES: Array<{
  id: DependencyId;
  name: string;
  critical: boolean;
  degradeStrategy: string;
}> = [
  {
    id: "vercel",
    name: "Vercel (app hosting)",
    critical: true,
    degradeStrategy: "Redeploy previous production deployment / promote preview",
  },
  {
    id: "supabase",
    name: "Supabase (Auth + Postgres)",
    critical: true,
    degradeStrategy: "PITR restore; freeze writes; status page",
  },
  {
    id: "database",
    name: "Postgres (via Supabase)",
    critical: true,
    degradeStrategy: "Point-in-time recovery; migration re-apply if needed",
  },
  {
    id: "openai",
    name: "OpenAI (chat / STT / assessment)",
    critical: false,
    degradeStrategy: "Circuit open → persona / heuristic fallback",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs (TTS)",
    critical: false,
    degradeStrategy: "Circuit open → browser speechSynthesis / text-only",
  },
  {
    id: "upstash",
    name: "Upstash Redis (rate limits)",
    critical: false,
    degradeStrategy: "Per-isolate memory rate limit fallback",
  },
];

export type IncidentStub = {
  id: string;
  severity: IncidentSeverity;
  title: string;
  dependency: DependencyId;
  detectedAt: string;
  status: "open" | "mitigating" | "resolved";
  checklist: string[];
};

export function createIncidentStub(input: {
  severity: IncidentSeverity;
  title: string;
  dependency: DependencyId;
  now?: Date;
}): IncidentStub {
  const base = [
    "Acknowledge alert / page on-call",
    "Check /api/health and /api/health/ready",
    "Confirm blast radius (auth, sessions, voice, assessment)",
    "Enable or verify graceful degradation paths",
    "Communicate status to stakeholders",
    "Capture timeline for postmortem",
  ];
  const byDep: Partial<Record<DependencyId, string[]>> = {
    openai: [
      "Verify OPENAI_API_KEY / quota",
      "Confirm persona_fallback and assessment heuristic active",
    ],
    elevenlabs: [
      "Verify ELEVENLABS_API_KEY",
      "Confirm browser TTS fallback in client",
    ],
    supabase: [
      "Check Supabase status page",
      "Do not run destructive migrations during outage",
      "Prepare PITR restore window if data loss suspected",
    ],
    database: [
      "Identify last known-good backup / PITR timestamp",
      "Estimate RPO impact before restore",
    ],
    vercel: [
      "Inspect latest deployment / rollback candidate",
      "vercel rollback or promote previous production",
    ],
    upstash: [
      "Confirm memory rate-limit fallback warnings",
      "Restore UPSTASH_REDIS_REST_* when Redis returns",
    ],
  };

  return {
    id: `inc_${Date.now().toString(36)}`,
    severity: input.severity,
    title: input.title,
    dependency: input.dependency,
    detectedAt: (input.now ?? new Date()).toISOString(),
    status: "open",
    checklist: [...base, ...(byDep[input.dependency] ?? [])],
  };
}

export function severityForDependency(
  id: DependencyId,
  fullyDown: boolean,
): IncidentSeverity {
  const dep = DEPENDENCIES.find((d) => d.id === id);
  if (!dep) return "SEV3";
  if (dep.critical && fullyDown) return "SEV1";
  if (dep.critical) return "SEV2";
  if (fullyDown) return "SEV2";
  return "SEV3";
}
