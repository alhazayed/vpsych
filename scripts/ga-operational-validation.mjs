#!/usr/bin/env node
/**
 * GA Controlled Institutional Deployment — structural validation gate.
 * Complements Vitest ops suite. Does not hammer production.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const warns = [];

function must(path, label = path) {
  if (!existsSync(join(root, path))) fails.push(`missing ${label}`);
}

const docs = [
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
  "docs/GA_READINESS_REPORT.md",
  "docs/ga/EXECUTIVE_SUMMARY.md",
];
for (const d of docs) must(d);

must("supabase/migrations/20260807184117_institutional_feedback_ga.sql");
must("src/lib/feedback/index.ts");
must("src/lib/ops/telemetry.ts");
must("src/lib/ops/dashboards.ts");
must("CHANGELOG.md");

const ownership = readFileSync(
  join(root, "docs/runtime/ENGINE_OWNERSHIP.md"),
  "utf8",
);
if (!ownership.includes("Institutional feedback")) {
  fails.push("ENGINE_OWNERSHIP missing institutional feedback row");
}
if (!ownership.includes("Forbidden ownership claims")) {
  fails.push("ownership forbidden claims section missing");
}
if (!ownership.includes("Institutional feedback must not write clinical_snapshot")) {
  fails.push("feedback ownership forbid missing");
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.version !== "1.0.0-rc.1") {
  fails.push(`unexpected package version ${pkg.version}`);
}

try {
  const tags = execSync("git tag -l v1.0.0-rc.1", { cwd: root, encoding: "utf8" });
  if (!tags.includes("v1.0.0-rc.1")) warns.push("local tag v1.0.0-rc.1 missing");
} catch {
  warns.push("unable to list git tags");
}

warns.push(
  "Live DR PITR restore + external pilot critical-issue clearance remain ops residuals (NO-GO for unconstrained GA)",
);

if (fails.length) {
  console.error("ga-operational-validation: FAIL");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}

console.log("ga-operational-validation: PASS (structural)");
for (const w of warns) console.log(" WARN:", w);
console.log("Recommendation gate: NO-GO for full GA until WARN residuals cleared");
