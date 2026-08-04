/**
 * Filesystem loader for the calibration corpus.
 *
 * Kept separate from `calibration.ts` so the types and validators stay free of
 * `node:fs` and remain importable from anywhere.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  validateCalibrationCase,
  type CalibrationCase,
} from "@/lib/ai/calibration";

export const CALIBRATION_DIR = "calibration";

export type CorpusLoadResult = {
  cases: CalibrationCase[];
  /** Fixture cases, kept separate so they can never enter a baseline by accident. */
  fixtures: CalibrationCase[];
  errors: string[];
};

/**
 * Read and validate every `*.case.json` under `dir`.
 *
 * Fixtures (`"fixture": true`) are returned separately rather than mixed into
 * `cases` — a format-demonstration file must never silently become part of a
 * reported reliability figure.
 */
export function loadCalibrationCases(dir: string): CorpusLoadResult {
  const cases: CalibrationCase[] = [];
  const fixtures: CalibrationCase[] = [];
  const errors: string[] = [];

  let fileNames: string[] = [];
  try {
    fileNames = readdirSync(dir)
      .filter((f) => f.endsWith(".case.json"))
      .sort();
  } catch (err) {
    return {
      cases,
      fixtures,
      errors: [
        `cannot read calibration dir ${dir}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }

  const seenIds = new Set<string>();

  for (const fileName of fileNames) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, fileName), "utf8"));
    } catch (err) {
      errors.push(
        `${fileName}: not valid JSON — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      continue;
    }

    const result = validateCalibrationCase(parsed);
    if (!result.ok) {
      for (const problem of result.errors) {
        errors.push(`${fileName}: ${problem}`);
      }
      continue;
    }

    if (seenIds.has(result.value.caseId)) {
      errors.push(`${fileName}: duplicate caseId "${result.value.caseId}"`);
      continue;
    }
    seenIds.add(result.value.caseId);

    if (result.value.fixture) {
      fixtures.push(result.value);
    } else {
      cases.push(result.value);
    }
  }

  return { cases, fixtures, errors };
}
