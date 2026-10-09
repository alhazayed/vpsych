import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sessionStartErrorKey } from "@/lib/session-start-error";

type Messages = { session: { start: Record<string, string> } };
const load = (l: string) =>
  JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Messages;
const en = load("en");
const ar = load("ar");

describe("sessionStartErrorKey", () => {
  it("maps known statuses", () => {
    expect(sessionStartErrorKey(401)).toBe("signedOut");
    expect(sessionStartErrorKey(429)).toBe("rateLimited");
    expect(sessionStartErrorKey(404)).toBe("patientUnavailable");
    expect(sessionStartErrorKey(422)).toBe("patientUnavailable");
  });
  it("falls back to the generic message", () => {
    expect(sessionStartErrorKey(500)).toBe("failed");
    expect(sessionStartErrorKey(502)).toBe("failed");
    expect(sessionStartErrorKey(400)).toBe("failed");
  });
  it("prefers the route's error code over the status", () => {
    expect(sessionStartErrorKey(403, "ladder_level_locked")).toBe("ladderLocked");
    expect(sessionStartErrorKey(409, "treatment_plan_required")).toBe("treatmentPlanRequired");
    expect(sessionStartErrorKey(409, "skill_test_sessions_used")).toBe("testSessionsUsed");
    expect(sessionStartErrorKey(409, "something_new")).toBe("patientUnavailable");
    expect(sessionStartErrorKey(500, "toString")).toBe("failed");
  });
  it("has a translation for every code the start route can send", () => {
    const sources = [
      "src/app/api/sessions/route.ts",
      "src/lib/skill-tests/start.ts",
      "src/lib/skill-tests/persist.ts",
      "src/lib/training-ladder/persist.ts",
    ].map((f) => readFileSync(f, "utf8"));
    const codes = new Set(
      sources.flatMap((s) =>
        [...s.matchAll(/code: "([a-z_]+)"/g)].map((m) => m[1]),
      ),
    );
    expect(codes.size).toBeGreaterThan(5);
    for (const code of codes) {
      const key = sessionStartErrorKey(500, code);
      if (code !== "ladder_attempt_failed") expect(key, code).not.toBe("failed");
      expect(en.session.start[key], `en ${key}`).toBeTruthy();
      expect(ar.session.start[key], `ar ${key}`).toBeTruthy();
    }
  });
});
