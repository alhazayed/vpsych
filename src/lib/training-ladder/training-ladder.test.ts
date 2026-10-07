import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findDifficulty,
  findDisorderBySlug,
  findTherapy,
} from "@/lib/case-engine/catalog";
import { getComorbidityCompatibility } from "@/lib/case-engine/comorbidity-compat";
import {
  applyRiskOverlay,
  generateCaseInstance,
} from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import type { ClinicalCore } from "@/lib/types";
import {
  LADDER_LEVELS,
  LADDER_PATIENTS,
  attemptOutcome,
  buildLadderAttemptSignaturePayload,
  canStartLadderLevel,
  isLadderLevel,
  isLadderPass,
  ladderComorbidities,
  ladderLevelDef,
  ladderProgress,
  ladderRiskOverlay,
  normalizeLadderAttempt,
  numberAttempts,
  signLadderAttempt,
  withoutLadderAvatars,
  type LadderLevel,
} from "@/lib/training-ladder";
import { LADDER_PATIENTS_MIGRATION } from "@/lib/training-ladder/patient-migration";

const root = join(__dirname, "../../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const MIGRATION = "supabase/migrations/20261007100000_training_ladder.sql";

describe("pass rule", () => {
  it("passes only a score strictly above 55", () => {
    expect(isLadderPass(54)).toBe(false);
    expect(isLadderPass(55)).toBe(false);
    expect(isLadderPass(55.0)).toBe(false);
    expect(isLadderPass(55.01)).toBe(true);
    expect(isLadderPass(56)).toBe(true);
    expect(isLadderPass(70)).toBe(true);
    expect(isLadderPass(null)).toBe(false);
    expect(isLadderPass(Number.NaN)).toBe(false);
  });

  it("uses the same rule in the database trigger that grades attempts", () => {
    const sql = read(MIGRATION);
    expect(sql).toContain("WHEN v_overall > 55 THEN 'passed'");
    expect(sql).not.toMatch(/v_overall >= 55/);
    // Fallback-examiner reports never pass or fail an attempt.
    expect(sql).toContain("'heuristic_fallback'");
    expect(sql).toMatch(/WHEN v_heuristic OR v_overall IS NULL THEN 'awaiting_score'/);
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OF scores ON public\.session_reports/);
  });
});

describe("levels", () => {
  it("has five levels Easy to Expert on existing difficulty profiles", () => {
    expect(LADDER_LEVELS.map((l) => l.key)).toEqual([
      "easy",
      "basic",
      "intermediate",
      "advanced",
      "expert",
    ]);
    for (const l of LADDER_LEVELS) {
      expect(findDifficulty(l.difficulty)).toBeTruthy();
    }
    expect(isLadderLevel(0)).toBe(false);
    expect(isLadderLevel(6)).toBe(false);
    expect(isLadderLevel(2.5)).toBe(false);
    expect(isLadderLevel("3")).toBe(false);
    expect(isLadderLevel(3)).toBe(true);
  });
});

describe("program", () => {
  it("has unique keys, slots and patients", () => {
    const keys = LADDER_PATIENTS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(LADDER_PATIENTS.map((p) => p.slot)).size).toBe(keys.length);
    expect(new Set(LADDER_PATIENTS.map((p) => p.avatarSlug)).size).toBe(
      keys.length,
    );
    expect(
      new Set(LADDER_PATIENTS.map((p) => p.primaryDisorderSlug)).size,
    ).toBe(keys.length);
  });

  it("only uses comorbidities the Case Engine authored as compatible", () => {
    for (const p of LADDER_PATIENTS) {
      expect(findDisorderBySlug(p.primaryDisorderSlug)).toBeTruthy();
      let previous = 0;
      for (const { level } of LADDER_LEVELS) {
        const slugs = ladderComorbidities(p, level);
        // Complexity never drops as the trainee climbs.
        expect(slugs.length).toBeGreaterThanOrEqual(previous);
        previous = slugs.length;
        for (const slug of slugs) {
          expect(
            getComorbidityCompatibility(p.primaryDisorderSlug, slug)
              .previewAllowed,
          ).toBe(true);
        }
      }
    }
  });

  it("seeds every program patient in the database mirror", () => {
    const sql = read(LADDER_PATIENTS_MIGRATION);
    for (const p of LADDER_PATIENTS) {
      expect(sql).toContain(`SELECT '${p.key}', ${p.slot}, a.id`);
      expect(sql).toContain(`WHERE a.slug = '${p.avatarSlug}'`);
    }
  });

  it("mints a valid case for every patient and level through the Case Engine", () => {
    for (const p of LADDER_PATIENTS) {
      const primary = findDisorderBySlug(p.primaryDisorderSlug)!;
      const persona: PersonaRow = {
        id: `persona-${p.key}`,
        avatar_id: `avatar-${p.key}`,
        slug: p.avatarSlug,
        display_name: p.key,
        identity: { age: 30, gender: "female" },
        traits: {},
        baseline_history: {},
        default_disorder_id: primary.id,
        is_active: true,
      };
      for (const { level } of LADDER_LEVELS) {
        const def = ladderLevelDef(level);
        const result = generateCaseInstance({
          persona,
          avatarId: persona.avatar_id!,
          primaryDisorder: primary,
          comorbidities: ladderComorbidities(p, level).map(
            (s) => findDisorderBySlug(s)!,
          ),
          difficulty: def.difficulty,
          therapyModality: "supportive",
          locale: "en-US",
          seed: `${p.key}:${level}`,
          difficultyProfile: findDifficulty(def.difficulty),
          therapyProfile: findTherapy("supportive"),
          riskOverlay: ladderRiskOverlay(level, p.risk),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        const core = result.snapshot.clinical_core;
        // Risk is present on every level, and never more than passive.
        expect(core.risk_profile.suicidal_ideation).toBe("passive");
        expect(
          core.disclosure_rules.some((r) =>
            r.notes?.includes(`Training level`),
          ),
        ).toBe(true);
        expect(result.snapshot.primary_diagnosis.slug).toBe(
          p.primaryDisorderSlug,
        );
        expect(result.snapshot.difficulty).toBe(def.difficulty);
      }
    }
  });
});

describe("risk overlay", () => {
  const core: ClinicalCore = {
    disorder: "x",
    age: 30,
    gender: "female",
    symptom_profile: [],
    disclosure_rules: [
      { topic: "low mood", condition: "volunteered" },
      { topic: "passive suicidal ideation", condition: "on_safety_assessment", notes: "Authored." },
      { topic: "any method or means of self-harm", condition: "never" },
    ],
    session_goals: [],
    ideal_approach: "",
    risk_profile: { suicidal_ideation: "none", self_harm: false },
  };

  it("raises risk, keeps authored notes and leaves 'never' rules alone", () => {
    const out = applyRiskOverlay(core, ladderRiskOverlay(4, { selfHarmHistory: false }));
    expect(out.risk_profile.suicidal_ideation).toBe("passive");
    expect(out.risk_profile.self_harm).toBe(false);
    const si = out.disclosure_rules.find((r) => r.topic === "passive suicidal ideation")!;
    expect(si.condition).toBe("on_empathic_rapport");
    expect(si.notes).toMatch(/^Authored\. \| Training level Advanced/);
    const never = out.disclosure_rules.find((r) => r.condition === "never")!;
    expect(never.notes).toBeUndefined();
    expect(out.disclosure_rules).toHaveLength(3);
    expect(out.disclosure_rules[0]).toEqual(core.disclosure_rules[0]);
  });

  it("never lowers authored risk", () => {
    const active: ClinicalCore = {
      ...core,
      risk_profile: { suicidal_ideation: "active_no_plan", self_harm: true },
    };
    const out = applyRiskOverlay(active, ladderRiskOverlay(1, { selfHarmHistory: false }));
    expect(out.risk_profile.suicidal_ideation).toBe("active_no_plan");
    expect(out.risk_profile.self_harm).toBe(true);
  });

  it("adds a rule when the case has none", () => {
    const bare: ClinicalCore = { ...core, disclosure_rules: [] };
    const out = applyRiskOverlay(bare, ladderRiskOverlay(1, { selfHarmHistory: true }));
    expect(out.disclosure_rules).toEqual([
      expect.objectContaining({
        topic: "suicidal thoughts and self-harm",
        condition: "on_safety_assessment",
      }),
    ]);
    expect(out.risk_profile.self_harm).toBe(true);
    expect(out.disclosure_rules[0]!.notes).toMatch(/Past self-harm/);
  });

  it("is a no-op without an overlay", () => {
    expect(applyRiskOverlay(core, null)).toBe(core);
  });

  it("gets harder to assess by level, never more suicidal", () => {
    const levels = LADDER_LEVELS.map(({ level }) =>
      ladderRiskOverlay(level, { selfHarmHistory: false }),
    );
    expect(new Set(levels.map((o) => o.suicidal_ideation))).toEqual(
      new Set(["passive"]),
    );
    expect(levels[0]!.disclosure.condition).toBe("on_safety_assessment");
    for (const o of levels) {
      expect(o.disclosure.notes).toMatch(/never a plan, never intent/);
      expect(o.disclosure.notes).toMatch(/Never describe methods or means/);
    }
  });
});

describe("progress", () => {
  const att = (level: number, status: "passed" | "failed" | "in_progress" | "awaiting_score") => ({
    level,
    status,
  });

  it("starts at Easy with everything else locked", () => {
    const p = ladderProgress([]);
    expect(p.currentLevel).toBe(1);
    expect(p.clearedCount).toBe(0);
    expect(p.levels.map((l) => l.state)).toEqual([
      "current",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
    expect(canStartLadderLevel(p, 1)).toBe(true);
    expect(canStartLadderLevel(p, 2)).toBe(false);
  });

  it("unlocks the next level only after a pass", () => {
    const failed = ladderProgress([att(1, "failed"), att(1, "awaiting_score")]);
    expect(failed.currentLevel).toBe(1);
    const p = ladderProgress([att(1, "failed"), att(1, "passed"), att(2, "passed"), att(3, "failed")]);
    expect(p.currentLevel).toBe(3);
    expect(p.clearedCount).toBe(2);
    expect(p.levels.map((l) => l.state)).toEqual([
      "cleared",
      "cleared",
      "current",
      "locked",
      "locked",
    ]);
    // Replaying a cleared level is allowed; jumping ahead is not.
    expect(canStartLadderLevel(p, 1)).toBe(true);
    expect(canStartLadderLevel(p, 4)).toBe(false);
  });

  it("does not count a pass above a gap", () => {
    const p = ladderProgress([att(1, "passed"), att(3, "passed")]);
    expect(p.clearedCount).toBe(1);
    expect(p.currentLevel).toBe(2);
  });

  it("completes the patient after Expert", () => {
    const p = ladderProgress([1, 2, 3, 4, 5].map((l) => att(l, "passed")));
    expect(p.completed).toBe(true);
    expect(p.currentLevel).toBe(5);
    expect(p.levels.every((l) => l.state === "cleared")).toBe(true);
  });

  it("numbers attempts per level and labels outcomes", () => {
    const rows = numberAttempts([
      { level: 2, created_at: "2026-10-07T10:00:00Z" },
      { level: 1, created_at: "2026-10-07T09:00:00Z" },
      { level: 1, created_at: "2026-10-07T08:00:00Z" },
    ]);
    expect(rows.map((r) => [r.level, r.attemptNumber])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
    expect(attemptOutcome({ status: "passed" })).toBe("passed");
    expect(attemptOutcome({ status: "failed" })).toBe("failed");
    expect(attemptOutcome({ status: "awaiting_score" })).toBe("scoring");
    expect(attemptOutcome({ status: "in_progress", session_status: "active" })).toBe("in_session");
    expect(attemptOutcome({ status: "in_progress", session_status: "completed" })).toBe("no_report");
  });
});

describe("server-side unlock", () => {
  it("signs the same payload the database checks", () => {
    expect(
      buildLadderAttemptSignaturePayload({ sessionId: "s1", patientKey: "maya", level: 3 }),
    ).toBe("s1\nmaya\n3");
    const sig = signLadderAttempt({ sessionId: "s1", patientKey: "maya", level: 3 as LadderLevel, key: "k" });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    const sql = read(MIGRATION);
    expect(sql).toContain(
      "p_session_id::text || E'\\n' || p_patient_key || E'\\n' || p_level::text",
    );
  });

  it("lets the database refuse a locked level and keeps writes off the client", () => {
    const sql = read(MIGRATION);
    expect(sql).toContain("IF p_level > least(v_cleared + 1, 5) THEN");
    expect(sql).toContain("RAISE EXCEPTION 'Ladder level is locked'");
    expect(sql).toContain("v_patient.avatar_id <> v_session.avatar_id");
    // No client write policies on attempts.
    expect(sql).not.toMatch(/ON public\.training_ladder_attempts\s+FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(sql).toContain("GRANT SELECT ON public.training_ladder_attempts TO authenticated;");
    expect(sql).not.toMatch(/GRANT [A-Z, ]*(INSERT|UPDATE|DELETE)[A-Z, ]* ON public\.training_ladder_attempts/);
  });

  it("the start route records the attempt and never takes a score from the body", () => {
    const route = read("src/app/api/sessions/route.ts");
    expect(route).toContain("await startLadderAttempt(supabase, {");
    expect(route).toContain("await closeFailedSessionStart(supabase, session.id);");
    expect(route).toContain("riskOverlay: ladderRiskOverlay(ladder.level, ladder.patient.risk)");
    expect(route).not.toMatch(/body\.(score|unlocked|ladderStatus)/);
  });

  it("keeps program patients out of the library, pickers and clinic", () => {
    expect(
      withoutLadderAvatars(
        [{ id: "a" }, { id: "ladder" }, { id: "b" }],
        new Set(["ladder"]),
      ),
    ).toEqual([{ id: "a" }, { id: "b" }]);
    for (const file of [
      "src/app/(app)/avatars/page.tsx",
      "src/app/(app)/supervise/new/page.tsx",
      "src/app/(app)/clinic/page.tsx",
      "src/app/api/clinic/day/route.ts",
    ]) {
      expect(read(file)).toContain("withoutLadderAvatars(");
    }
    expect(read("src/app/api/skill-tests/route.ts")).toContain(
      'code: "ladder_patient_only"',
    );
    // A program patient is only ever played through a ladder level.
    const route = read("src/app/api/sessions/route.ts");
    expect(route).toContain(
      "if (!ladder && (await loadLadderAvatarIds(supabase)).has(avatar.id as string)) {",
    );
    expect(route).toContain('code: "ladder_patient_only"');
  });

  it("normalizes attempts loaded with their session", () => {
    expect(
      normalizeLadderAttempt({
        id: "a",
        session_id: "s",
        patient_key: "maya",
        level: 1,
        status: "passed",
        score: "64.00",
        created_at: "t",
        sessions: [{ status: "completed" }],
      }),
    ).toEqual({
      id: "a",
      session_id: "s",
      patient_key: "maya",
      level: 1,
      status: "passed",
      score: 64,
      created_at: "t",
      session_status: "completed",
    });
  });
});
