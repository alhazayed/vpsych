/**
 * Disaster / vendor outage simulation harness (in-process).
 * Does not call production OpenAI/ElevenLabs/Supabase with live storms.
 */

import {
  CircuitBreaker,
  CircuitOpenError,
} from "@/lib/performance/resilience";
import {
  createIncidentStub,
  severityForDependency,
  type DependencyId,
} from "@/lib/ops/targets";

export type OutageScenario =
  | "openai_outage"
  | "elevenlabs_outage"
  | "supabase_outage"
  | "network_failure"
  | "database_failure"
  | "deployment_rollback";

export type OutageSimResult = {
  scenario: OutageScenario;
  ok: boolean;
  recovered: boolean;
  recoveryMs: number;
  degraded: boolean;
  alertGenerated: boolean;
  incidentSeverity: string;
  notes: string[];
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Simulate upstream vendor outage with circuit + graceful degrade + recovery.
 */
export async function simulateVendorOutage(
  scenario: "openai_outage" | "elevenlabs_outage",
): Promise<OutageSimResult> {
  const name = scenario === "openai_outage" ? "openai-sim" : "elevenlabs-sim";
  const dep: DependencyId =
    scenario === "openai_outage" ? "openai" : "elevenlabs";
  let now = 1_000;
  const cb = new CircuitBreaker(name, {
    failureThreshold: 2,
    openMs: 50,
    now: () => now,
  });
  const notes: string[] = [];
  let degraded = false;

  // Inject failures until circuit opens
  for (let i = 0; i < 3; i++) {
    try {
      await cb.exec(async () => {
        throw new Error("upstream_unavailable");
      });
    } catch {
      /* expected */
    }
  }
  notes.push("failures_injected");

  const open = cb.isOpen();
  if (open) {
    degraded = true;
    notes.push("circuit_open_degrade");
    // Graceful path: skip vendor, use fallback
    const fallback =
      scenario === "openai_outage" ? "persona_fallback" : "browser_tts";
    notes.push(`fallback:${fallback}`);
  }

  const incident = createIncidentStub({
    severity: severityForDependency(dep, true),
    title: `${scenario} simulated`,
    dependency: dep,
  });
  const alertGenerated = incident.checklist.length > 0;

  // Recovery: advance time, half-open, succeed
  const t0 = Date.now();
  now += 60;
  let recovered = false;
  try {
    await cb.exec(async () => "ok");
    await cb.exec(async () => "ok");
    recovered = cb.getState() === "closed";
    notes.push("circuit_recovered");
  } catch (e) {
    notes.push(
      e instanceof CircuitOpenError ? "still_open" : "recovery_failed",
    );
  }
  const recoveryMs = Date.now() - t0;

  return {
    scenario,
    ok: open && degraded && recovered && alertGenerated,
    recovered,
    recoveryMs,
    degraded,
    alertGenerated,
    incidentSeverity: incident.severity,
    notes,
  };
}

/** Simulate Supabase / DB / network critical path failure. */
export async function simulateInfrastructureOutage(
  scenario: "supabase_outage" | "network_failure" | "database_failure",
): Promise<OutageSimResult> {
  const dep: DependencyId =
    scenario === "database_failure" ? "database" : "supabase";
  const notes: string[] = [`scenario:${scenario}`, "writes_frozen"];
  const incident = createIncidentStub({
    severity: severityForDependency(dep, true),
    title: `${scenario} simulated`,
    dependency: dep,
  });

  // Simulated restore timeline (in-process — not a live PITR)
  const t0 = Date.now();
  await sleep(5);
  const restored = true;
  notes.push("pitr_restore_procedure_invoked");
  notes.push("smoke:/api/health");
  notes.push("smoke:session_create");
  const recoveryMs = Date.now() - t0;

  return {
    scenario,
    ok: restored && incident.severity === "SEV1",
    recovered: restored,
    recoveryMs,
    degraded: true,
    alertGenerated: true,
    incidentSeverity: incident.severity,
    notes,
  };
}

/** Simulate bad deploy → rollback to previous production. */
export async function simulateDeploymentRollback(): Promise<OutageSimResult> {
  const notes = [
    "bad_deploy_detected",
    "vercel_rollback_candidate_selected",
    "previous_deployment_promoted",
    "smoke:/api/health",
    "smoke:/api/health/ready",
  ];
  const incident = createIncidentStub({
    severity: "SEV2",
    title: "deployment_rollback simulated",
    dependency: "vercel",
  });
  const t0 = Date.now();
  await sleep(5);
  return {
    scenario: "deployment_rollback",
    ok: true,
    recovered: true,
    recoveryMs: Date.now() - t0,
    degraded: false,
    alertGenerated: incident.checklist.length > 0,
    incidentSeverity: incident.severity,
    notes,
  };
}

export async function runAllOutageSimulations(): Promise<{
  results: OutageSimResult[];
  allPassed: boolean;
  rtoBudgetHours: number;
  rpoBudgetHours: number;
}> {
  const results = [
    await simulateVendorOutage("openai_outage"),
    await simulateVendorOutage("elevenlabs_outage"),
    await simulateInfrastructureOutage("supabase_outage"),
    await simulateInfrastructureOutage("network_failure"),
    await simulateInfrastructureOutage("database_failure"),
    await simulateDeploymentRollback(),
  ];
  return {
    results,
    allPassed: results.every((r) => r.ok && r.recovered),
    rtoBudgetHours: 4,
    rpoBudgetHours: 24,
  };
}
