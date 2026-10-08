import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_RETRY_ATTEMPTS,
  ASSESSMENT_TIMEOUT_MS,
  PATIENT_REPLY_TIMEOUT_MS,
  SESSION_ROUTE_MAX_DURATION_SEC,
  STT_ROUTE_MAX_DURATION_SEC,
  STT_TIMEOUT_MS,
} from "@/lib/ai/time-budget";

const root = join(__dirname, "..", "..");

function declaredMaxDuration(route: string): number {
  const src = readFileSync(join(root, "app", "api", route), "utf8");
  const match = src.match(/export const maxDuration = (\d+);/);
  if (!match) throw new Error(`${route} declares no maxDuration`);
  return Number(match[1]);
}

/** withOpenAIRetry default attempts when a caller passes none. */
const DEFAULT_APP_ATTEMPTS = 2;

describe("AI time budget fits inside each route's maxDuration", () => {
  it("routes declare the budgeted maxDuration", () => {
    for (const route of [
      "sessions/[id]/message/route.ts",
      "sessions/[id]/message/stream/route.ts",
      "sessions/[id]/end/route.ts",
    ]) {
      expect(declaredMaxDuration(route)).toBe(SESSION_ROUTE_MAX_DURATION_SEC);
    }
    expect(declaredMaxDuration("voice/transcribe/route.ts")).toBe(
      STT_ROUTE_MAX_DURATION_SEC,
    );
  });

  it("a patient turn reaches persona fallback before the route is killed", () => {
    // primary (2 attempts) → fallback model (2 attempts, on 429) → gateway,
    // and the message route may regenerate once after a rejected reply.
    const oneGeneration =
      PATIENT_REPLY_TIMEOUT_MS * DEFAULT_APP_ATTEMPTS * 2 +
      PATIENT_REPLY_TIMEOUT_MS;
    expect(oneGeneration * 2).toBeLessThan(SESSION_ROUTE_MAX_DURATION_SEC * 1000);
  });

  it("the examiner reaches the heuristic fallback before the end route is killed", () => {
    // primary → fallback model → gateway, each one attempt.
    const worst = ASSESSMENT_TIMEOUT_MS * ASSESSMENT_RETRY_ATTEMPTS * 3;
    // Leave at least 20 s for loading the transcript and persisting the report.
    expect(worst + 20_000).toBeLessThanOrEqual(
      SESSION_ROUTE_MAX_DURATION_SEC * 1000,
    );
  });

  it("transcription returns an error before the transcribe route is killed", () => {
    expect(STT_TIMEOUT_MS * DEFAULT_APP_ATTEMPTS + 5_000).toBeLessThanOrEqual(
      STT_ROUTE_MAX_DURATION_SEC * 1000,
    );
  });
});
