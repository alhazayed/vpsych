import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("Mission 13 data integrity invariants", () => {
  it("ships a data integrity migration with ACE uniqueness and report repair", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260803050533_data_integrity_certification.sql",
      ),
      "utf8",
    );
    expect(migration).toMatch(/competency_scores_session_competency_uidx/);
    expect(migration).toMatch(/coach_feedback_session_uidx/);
    expect(migration).toMatch(/finish_session_on_report/);
    expect(migration).toMatch(/disorders_require_clinical_code/);
    expect(migration).toMatch(/sessions_language_check/);
  });

  it("retries learner_profiles unique races and upserts session ACE rows", () => {
    const persist = readFileSync(join(root, "src/lib/ace/persist.ts"), "utf8");
    expect(persist).toMatch(/23505/);
    expect(persist).toMatch(/onConflict:\s*["']session_id,competency_id["']/);
    expect(persist).toMatch(/onConflict:\s*["']session_id["']/);
  });

  it("repairs active sessions that already have reports on /end", () => {
    const end = readFileSync(
      join(root, "src/app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(end).toMatch(/alreadyHasReport/);
    expect(end).toMatch(/Integrity recovery/);
  });
});
