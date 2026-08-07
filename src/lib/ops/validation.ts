/**
 * GA operational validation suite — structural + simulated evidence.
 * Does not hit production with destructive load.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateProductionEnv } from "@/lib/env";
import { hasUpstashRedis } from "@/lib/rate-limit";
import { FEEDBACK_OWNERSHIP_RULE } from "@/lib/feedback";
import { clearTelemetryForTests, simulateSessionLoad, telemetrySummary } from "./telemetry";
import { GA_PROGRAM_ID, PACKAGE_VERSION } from "./versions";

export type ValidationCheck = {
  id: string;
  area: string;
  result: "PASS" | "FAIL" | "WARN" | "SKIP";
  detail: string;
};

function docExists(rel: string): boolean {
  return existsSync(join(process.cwd(), rel));
}

export function runOperationalValidation(opts?: {
  simulateSessions?: number;
}): {
  program_id: string;
  package_version: string;
  checked_at: string;
  checks: ValidationCheck[];
  pass: number;
  fail: number;
  warn: number;
  go_for_full_ga: boolean;
  recommendation: "GO" | "NO-GO";
  rationale: string[];
} {
  const checks: ValidationCheck[] = [];
  const push = (c: ValidationCheck) => checks.push(c);

  // Architecture / ownership
  push({
    id: "OWN-01",
    area: "ownership",
    result: FEEDBACK_OWNERSHIP_RULE.includes("Never writes clinical_snapshot")
      ? "PASS"
      : "FAIL",
    detail: "Feedback ownership forbids patient writers",
  });

  const ownership = readFileSync(
    join(process.cwd(), "docs/runtime/ENGINE_OWNERSHIP.md"),
    "utf8",
  );
  push({
    id: "OWN-02",
    area: "ownership",
    result: ownership.includes("Stage 12 **does not** own PatientDecisionPlan")
      ? "PASS"
      : "FAIL",
    detail: "Stage 12 non-ownership preserved",
  });

  // Docs package
  const requiredDocs = [
    "docs/GA_DEPLOYMENT_GUIDE.md",
    "docs/INSTITUTIONAL_ONBOARDING.md",
    "docs/FACULTY_MANUAL.md",
    "docs/RESIDENT_MANUAL.md",
    "docs/SUPERVISOR_MANUAL.md",
    "docs/RESEARCH_PROTOCOL.md",
    "docs/USER_FEEDBACK_FRAMEWORK.md",
    "docs/OPERATIONS_MONITORING.md",
    "docs/PRODUCTION_METRICS.md",
    "docs/ROLLBACK_PROCEDURES.md",
    "docs/KNOWN_LIMITATIONS.md",
  ];
  for (const d of requiredDocs) {
    push({
      id: `DOC-${d.split("/").pop()}`,
      area: "documentation",
      result: docExists(d) ? "PASS" : "FAIL",
      detail: d,
    });
  }

  // Env / security posture
  const env = validateProductionEnv();
  push({
    id: "ENV-01",
    area: "security",
    result: env.ok ? "PASS" : "WARN",
    detail: env.ok
      ? "Required env present in this runtime"
      : `Missing required: ${env.missingRequired.join(", ") || "n/a"}`,
  });
  push({
    id: "RL-01",
    area: "security",
    result: hasUpstashRedis() ? "PASS" : "WARN",
    detail: hasUpstashRedis()
      ? "Upstash configured"
      : "In-memory rate limit (not horizontally safe)",
  });

  // Migration for feedback
  push({
    id: "MIG-01",
    area: "migrations",
    result: docExists(
      "supabase/migrations/20260807184117_institutional_feedback_ga.sql",
    )
      ? "PASS"
      : "FAIL",
    detail: "institutional_feedback migration present (parity version 20260807184117)",
  });

  // Tag / version
  push({
    id: "VER-01",
    area: "release",
    result: PACKAGE_VERSION.startsWith("1.0.0") ? "PASS" : "FAIL",
    detail: `package ${PACKAGE_VERSION}`,
  });

  // Simulated load
  const simN = opts?.simulateSessions ?? 100;
  clearTelemetryForTests();
  const sim100 = simulateSessionLoad(Math.min(simN, 100));
  push({
    id: "LOAD-100",
    area: "performance",
    result: sim100.session_starts >= 100 && sim100.error_rate < 0.2 ? "PASS" : "FAIL",
    detail: `100-session simulation starts=${sim100.session_starts} drop_rate=${sim100.drop_rate.toFixed(3)}`,
  });
  clearTelemetryForTests();
  const sim1000 = simulateSessionLoad(1000);
  push({
    id: "LOAD-1000",
    area: "performance",
    result:
      sim1000.session_starts >= 1000 && sim1000.completion_rate > 0.9
        ? "PASS"
        : "FAIL",
    detail: `1000-session simulation completion_rate=${sim1000.completion_rate.toFixed(3)}`,
  });

  // DR / rollback — procedural evidence (docs + tag), not live restore
  push({
    id: "DR-01",
    area: "disaster_recovery",
    result: docExists("docs/DISASTER_RECOVERY.md") ? "PASS" : "FAIL",
    detail: "DR procedures documented",
  });
  push({
    id: "DR-02",
    area: "disaster_recovery",
    result: "WARN",
    detail:
      "Live PITR restore drill not executed in this certification agent — ops residual",
  });
  push({
    id: "RB-01",
    area: "rollback",
    result: docExists("docs/ROLLBACK_PROCEDURES.md") ? "PASS" : "FAIL",
    detail: "Rollback procedures documented",
  });
  push({
    id: "PILOT-01",
    area: "pilots",
    result: "WARN",
    detail:
      "No external pilot institution critical-issue clearance in this agent environment",
  });

  const pass = checks.filter((c) => c.result === "PASS").length;
  const fail = checks.filter((c) => c.result === "FAIL").length;
  const warn = checks.filter((c) => c.result === "WARN").length;

  const rationale: string[] = [];
  if (fail > 0) rationale.push(`${fail} FAIL checks block GA`);
  if (warn > 0) {
    rationale.push(
      `${warn} WARN checks (DR live drill, pilot clearance, Upstash/env) block unconstrained GA`,
    );
  }
  rationale.push(
    "Clinical scores remain unvalidated; scientific validation observational",
  );
  rationale.push(
    "RC1 Limited Institutional Production remains authorized (RDL-028)",
  );

  const go_for_full_ga = fail === 0 && warn === 0;
  // Per published criteria: WARN on pilot/DR means NO-GO for full GA
  const recommendation: "GO" | "NO-GO" = go_for_full_ga ? "GO" : "NO-GO";

  // Keep telemetry summary readable after suite
  void telemetrySummary();

  return {
    program_id: GA_PROGRAM_ID,
    package_version: PACKAGE_VERSION,
    checked_at: new Date().toISOString(),
    checks,
    pass,
    fail,
    warn,
    go_for_full_ga,
    recommendation,
    rationale,
  };
}
