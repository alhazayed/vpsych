#!/usr/bin/env node
/**
 * Generate Wave-2 SP library artifacts (38 patients → library total 50).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WAVE2 } from "./expand-wave2.mjs";
import { writeLibraryArtifacts } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

if (WAVE2.length !== 38) {
  console.error(`Expected 38 Wave-2 patients, got ${WAVE2.length}`);
  process.exit(1);
}

writeLibraryArtifacts({
  root: ROOT,
  cases: WAVE2,
  startIndex: 11, // Wave-1 used 1–10
  migrationFilename: "20260807210000_simulated_patient_library_wave2.sql",
  migrationName: "Wave-2",
  waveKey: "wave2",
  therapyOut: "src/lib/case-engine/authored-therapy-cues-wave2.ts",
  personalityOut: "src/lib/personality-engine/wave2-catalog.ts",
  therapyExportName: "WAVE2_THERAPY_CUES",
  therapyKeyName: "Wave2TherapyCueKey",
  personalityExportName: "WAVE2_HUMAN_PERSONALITIES",
});

console.log("Wave-2 generation complete:", WAVE2.length, "patients");
