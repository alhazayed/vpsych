#!/usr/bin/env node
/**
 * Stage 12 performance smoke — local budget assertions (no live load).
 *
 * Full 1000-concurrent / 100k-user simulation is an ops drill (see
 * docs/PERFORMANCE_REPORT.md). This gate only verifies that latency budget
 * constants and ownership docs remain coherent so CI cannot silently drift.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function mustInclude(path, patterns) {
  const text = readFileSync(join(root, path), "utf8");
  for (const p of patterns) {
    if (!text.includes(p)) {
      throw new Error(`${path} missing required marker: ${p}`);
    }
  }
}

mustInclude("docs/runtime/LATENCY_BUDGET.md", ["p50", "p95"]);
mustInclude("src/lib/ops/metrics.ts", [
  "voice_e2e_p50_target_ms",
  "elevenlabs_timeout_ms",
]);
mustInclude("src/lib/voice/elevenlabs/service.ts", [
  "AbortSignal.timeout",
  "elevenLabsTimeoutMs",
]);
mustInclude("package.json", ["1.0.0-rc.1"]);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.version !== "1.0.0-rc.1") {
  throw new Error(`package version drift: ${pkg.version}`);
}

console.log("perf-smoke: PASS (latency budgets + TTS timeout markers intact)");
