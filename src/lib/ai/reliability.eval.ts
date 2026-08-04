/**
 * Calibration harness — the only file here that calls a real provider.
 *
 * Run with `npm run test:reliability`. It is excluded from the default vitest
 * glob (`src/**\/*.test.ts`) because it is slow and costs money: it scores each
 * calibration transcript several times to measure the grader's own stability.
 *
 * Environment:
 *   OPENAI_API_KEY / AI_GATEWAY_API_KEY  required — skips cleanly without one
 *   VPSYCH_RELIABILITY_RUNS              repeats per case (default 3)
 *   VPSYCH_RELIABILITY_INCLUDE_FIXTURES  set to 1 to include synthetic fixtures
 *   VPSYCH_RELIABILITY_MIN_ICC           fail below this expert-agreement ICC
 *   VPSYCH_RELIABILITY_MAX_SWING         fail above this 0-100 run-to-run swing
 */

import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { assessSession } from "@/lib/ai/assessment";
import {
  calibrationReference,
  corpusInterRaterReliability,
  type CalibrationCase,
} from "@/lib/ai/calibration";
import {
  CALIBRATION_DIR,
  loadCalibrationCases,
} from "@/lib/ai/calibration-load";
import { hasAnyAiKey } from "@/lib/ai/provider";
import { reliabilityBand } from "@/lib/ai/reliability";
import {
  renderReliabilityReport,
  summarizeCorpus,
  type CaseRun,
} from "@/lib/ai/reliability-report";

const RUNS = Number(process.env.VPSYCH_RELIABILITY_RUNS ?? 3);
const INCLUDE_FIXTURES = process.env.VPSYCH_RELIABILITY_INCLUDE_FIXTURES === "1";
const MIN_ICC = process.env.VPSYCH_RELIABILITY_MIN_ICC
  ? Number(process.env.VPSYCH_RELIABILITY_MIN_ICC)
  : null;
const MAX_SWING = process.env.VPSYCH_RELIABILITY_MAX_SWING
  ? Number(process.env.VPSYCH_RELIABILITY_MAX_SWING)
  : null;

const loaded = loadCalibrationCases(join(process.cwd(), CALIBRATION_DIR));
const corpus: CalibrationCase[] = INCLUDE_FIXTURES
  ? [...loaded.cases, ...loaded.fixtures]
  : loaded.cases;

async function scoreCase(input: CalibrationCase): Promise<CaseRun> {
  const reference = calibrationReference(input);
  const modelRuns: Record<string, number>[] = [];
  const aiSources: string[] = [];

  for (let run = 0; run < RUNS; run += 1) {
    const assessment = await assessSession({
      avatar: {
        name: input.avatar.name,
        disorder: input.avatar.disorder,
        ideal_guidelines: input.avatar.ideal_guidelines,
        rubric: input.avatar.rubric,
      },
      messages: input.transcript.map((t) => ({
        role: t.role,
        content: t.content,
        created_at: new Date().toISOString(),
      })),
      durationSec: input.durationSec,
      language: input.language,
    });

    modelRuns.push(
      Object.fromEntries(
        assessment.scores.items.map((i) => [i.id, i.score]),
      ),
    );
    aiSources.push(assessment.aiSource);
  }

  return {
    caseId: input.caseId,
    language: input.language,
    rubric: input.avatar.rubric,
    consensus: reference.consensus,
    consensusOverall: reference.consensusOverall,
    interRater: reference.interRater,
    modelRuns,
    aiSources,
  };
}

describe("assessment reliability", () => {
  it("has a loadable calibration corpus", () => {
    expect(loaded.errors).toEqual([]);
  });

  const runnable = hasAnyAiKey() && corpus.length > 0;

  it.runIf(runnable)(
    "scores the corpus and reports agreement with expert consensus",
    async () => {
      const runs: CaseRun[] = [];
      for (const input of corpus) {
        runs.push(await scoreCase(input));
      }

      const summary = summarizeCorpus(runs);
      const humanAgreement = corpusInterRaterReliability(corpus);

      console.info(`\n${renderReliabilityReport(summary)}`);
      console.info(
        `\nHuman raters, pooled: ${
          humanAgreement
            ? `${humanAgreement.icc.toFixed(3)} (${reliabilityBand(humanAgreement.icc)})`
            : "n/a — rater set varies between cases"
        }`,
      );
      if (INCLUDE_FIXTURES) {
        console.warn(
          "\nWARNING: synthetic fixtures were included. These numbers are not a calibration result.",
        );
      }

      // The harness always reports. It only fails when a threshold is set,
      // so it can be adopted before a corpus is large enough to gate on.
      if (MIN_ICC !== null) {
        expect(summary.modelVsExpert).not.toBeNull();
        expect(summary.modelVsExpert!.icc).toBeGreaterThanOrEqual(MIN_ICC);
      }
      if (MAX_SWING !== null) {
        expect(summary.worstOverallRange).toBeLessThanOrEqual(MAX_SWING);
      }
    },
    1000 * 60 * 10,
  );

  it.skipIf(runnable)("skips scoring without a key or a corpus", () => {
    const reason = !hasAnyAiKey()
      ? "no OPENAI_API_KEY / AI_GATEWAY_API_KEY"
      : "no non-fixture calibration cases in calibration/";
    console.warn(`[reliability] skipped model scoring — ${reason}`);
    expect(runnable).toBe(false);
  });
});
