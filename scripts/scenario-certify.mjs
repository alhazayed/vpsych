/**
 * Mission 17 — Scenario certification CLI.
 * Runs static board scoring and writes matrices under VPSYCH_SCENARIO_OUT.
 *
 * Usage: node --experimental-strip-types scripts/scenario-certify.mjs
 * (Prefer: npx vitest run src/lib/clinical/scenario-certification.test.ts)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUT =
  process.env.VPSYCH_SCENARIO_OUT ||
  "/opt/cursor/artifacts/scenario-cert";

async function main() {
  // Delegate to vitest for typed module resolution in the app.
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    [
      "./node_modules/vitest/vitest.mjs",
      "run",
      "src/lib/clinical/scenario-certification.test.ts",
      "src/lib/clinical/clinical-fidelity.test.ts",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, VPSYCH_SCENARIO_OUT: OUT },
    },
  );
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "harness-exit.json"),
    JSON.stringify(
      {
        exitCode: r.status,
        at: new Date().toISOString(),
        note: "See vitest output; matrices written by scenario-certification.test.ts",
      },
      null,
      2,
    ),
  );
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
