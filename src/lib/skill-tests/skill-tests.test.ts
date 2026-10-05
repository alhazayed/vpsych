import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSkillTestSessionContext,
  decideSkillTestStart,
  isPatientCompatible,
  isSessionLive,
  listAllowedComorbidities,
  listDisorderOptions,
  skillTestDbError,
  validateSkillTestInput,
} from "@/lib/skill-tests";
import { formatTherapyCoursePromptBlock } from "@/lib/therapy-course";
import { getComorbidityCompatibility } from "@/lib/case-engine/comorbidity-compat";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const TRAINEE = "11111111-1111-4111-8111-111111111111";
const AVATAR = "22222222-2222-4222-8222-222222222222";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    traineeId: TRAINEE,
    avatarId: AVATAR,
    title: "PTSD intake",
    language: "ar-JO",
    disorderSlug: "ptsd",
    comorbiditySlugs: [],
    difficulty: "advanced",
    severity: "moderate",
    requiredSessions: 3,
    traineeInstructions: "  Focus on risk.  ",
    dueAt: null,
    ...overrides,
  };
}

describe("skill test catalog", () => {
  it("lists every active builtin disorder", () => {
    const slugs = listDisorderOptions().map((d) => d.slug);
    expect(slugs).toContain("ptsd");
    expect(slugs).toContain("mdd-recurrent-moderate");
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only offers comorbidities the Case Engine accepts", () => {
    for (const { slug } of listDisorderOptions()) {
      for (const c of listAllowedComorbidities(slug)) {
        expect(c).not.toBe(slug);
        expect(getComorbidityCompatibility(slug, c).previewAllowed).toBe(true);
      }
    }
  });

  it("applies disorder age limits to patients", () => {
    expect(isPatientCompatible("ptsd", { age: 34, gender: "female" })).toBe(true);
    expect(isPatientCompatible("not-a-disorder", { age: 34, gender: "female" })).toBe(
      false,
    );
    expect(isPatientCompatible("ptsd", { age: 3, gender: "female" })).toBe(false);
  });
});

describe("validateSkillTestInput", () => {
  it("accepts a complete spec and trims text", () => {
    const r = validateSkillTestInput(validBody());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.traineeInstructions).toBe("Focus on risk.");
      expect(r.value.requiredSessions).toBe(3);
      expect(r.value.language).toBe("ar-JO");
    }
  });

  it.each([
    [{ traineeId: "nope" }, "trainee_required"],
    [{ avatarId: undefined }, "patient_required"],
    [{ title: "   " }, "title_invalid"],
    [{ language: "fr-FR" }, "language_invalid"],
    [{ disorderSlug: "made-up" }, "disorder_invalid"],
    [{ comorbiditySlugs: ["ptsd"] }, "comorbidity_invalid"],
    [{ comorbiditySlugs: ["made-up"] }, "comorbidity_invalid"],
    [{ difficulty: "impossible" }, "difficulty_invalid"],
    [{ severity: "extreme" }, "severity_invalid"],
    [{ requiredSessions: 0 }, "sessions_invalid"],
    [{ requiredSessions: 13 }, "sessions_invalid"],
    [{ requiredSessions: 2.5 }, "sessions_invalid"],
    [{ traineeInstructions: "x".repeat(1001) }, "instructions_too_long"],
    [{ dueAt: "2000-01-01" }, "due_date_invalid"],
  ])("rejects %j as %s", (overrides, code) => {
    const r = validateSkillTestInput(validBody(overrides));
    expect(r).toEqual({ ok: false, error: code });
  });

  it("caps comorbidities at two", () => {
    const allowed = listAllowedComorbidities("ptsd");
    if (allowed.length >= 3) {
      const r = validateSkillTestInput(
        validBody({ comorbiditySlugs: allowed.slice(0, 3) }),
      );
      expect(r).toEqual({ ok: false, error: "comorbidity_invalid" });
    }
    if (allowed.length >= 1) {
      const r = validateSkillTestInput(
        validBody({ comorbiditySlugs: [allowed[0], allowed[0]] }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.comorbiditySlugs).toEqual([allowed[0]]);
    }
  });
});

describe("decideSkillTestStart", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const assignment = {
    trainee_id: TRAINEE,
    status: "assigned" as const,
    required_sessions: 2,
  };
  const finished = {
    status: "completed",
    started_at: "2026-10-04T12:00:00Z",
    max_duration_sec: 2400,
  };

  it("starts session 1, then the final session", () => {
    expect(decideSkillTestStart(assignment, TRAINEE, [], now)).toEqual({
      kind: "start",
      sessionNumber: 1,
      isFinal: false,
    });
    expect(
      decideSkillTestStart(
        { ...assignment, status: "in_progress" },
        TRAINEE,
        [finished],
        now,
      ),
    ).toEqual({ kind: "start", sessionNumber: 2, isFinal: true });
  });

  it("blocks other trainees, closed tests, open sessions and used-up tests", () => {
    expect(decideSkillTestStart(assignment, AVATAR, [], now)).toMatchObject({
      code: "skill_test_not_assigned",
    });
    expect(decideSkillTestStart(null, TRAINEE, [], now)).toMatchObject({
      code: "skill_test_not_assigned",
    });
    expect(
      decideSkillTestStart({ ...assignment, status: "cancelled" }, TRAINEE, [], now),
    ).toMatchObject({ code: "skill_test_closed" });
    const live = {
      status: "active",
      started_at: "2026-10-05T11:50:00Z",
      max_duration_sec: 2400,
    };
    expect(isSessionLive(live, now)).toBe(true);
    expect(decideSkillTestStart(assignment, TRAINEE, [live], now)).toMatchObject({
      code: "skill_test_session_active",
    });
    expect(
      decideSkillTestStart(assignment, TRAINEE, [finished, finished], now),
    ).toMatchObject({ code: "skill_test_sessions_used" });
  });

  it("does not count a timed-out active session as open", () => {
    const stale = {
      status: "active",
      started_at: "2026-10-05T10:00:00Z",
      max_duration_sec: 2400,
    };
    expect(isSessionLive(stale, now)).toBe(false);
  });
});

describe("skill test patient prompt", () => {
  it("reuses the course block: visit number, no treatment plan", () => {
    const first = formatTherapyCoursePromptBlock(
      buildSkillTestSessionContext({
        assignmentId: "a",
        sessionNumber: 1,
        requiredSessions: 3,
      }),
    );
    expect(first).toContain("This is session 1 of a planned course of about 3 sessions");
    expect(first).not.toContain("treatment plan");

    const last = formatTherapyCoursePromptBlock(
      buildSkillTestSessionContext({
        assignmentId: "a",
        sessionNumber: 3,
        requiredSessions: 3,
      }),
    );
    expect(last).toContain("planned as your last session");
  });
});

describe("skillTestDbError", () => {
  it("maps trigger rejections to client-safe messages", () => {
    expect(skillTestDbError("skill_test_sessions_used")?.status).toBe(409);
    expect(skillTestDbError("ERROR: skill_test_case_mismatch")?.code).toBe(
      "skill_test_case_mismatch",
    );
    expect(skillTestDbError("duplicate key value")).toBeNull();
    expect(skillTestDbError(undefined)).toBeNull();
  });
});

describe("skill test guardrails (source)", () => {
  const migration = read(
    "supabase/migrations/20261005110000_supervisor_skill_tests.sql",
  );

  it("keeps results behind RLS for the assigning supervisor and admins", () => {
    expect(migration).toContain(
      'CREATE POLICY "Skill test supervisors can view test reports" ON public.session_reports',
    );
    expect(migration).toContain("public.session_messages_readable(session_id)");
    // No UPDATE/DELETE policy on assignments: lifecycle goes through triggers.
    expect(migration).not.toMatch(
      /CREATE POLICY[^;]+ON public\.skill_test_assignments\s+FOR (UPDATE|DELETE)/,
    );
    expect(migration).toContain("GRANT SELECT, INSERT ON public.skill_test_assignments TO authenticated;");
    // Supervisor role writes are admin-only.
    expect(migration).toMatch(
      /"Supervisors admin insert" ON public\.supervisors\s+FOR INSERT TO authenticated\s+WITH CHECK \(\(select public\.is_admin\(\)\)\)/,
    );
  });

  it("keeps skill test results out of trainee-facing learning", () => {
    const end = read("src/app/api/sessions/[id]/end/route.ts");
    expect(end).toContain("const isSkillTest = Boolean(typed.skill_test_assignment_id);");
    expect(end).toMatch(/isSkillTest\s*\?\s*SKIPPED_EDUCATION/);
    expect(end).toMatch(/isSkillTest\s*\?\s*SKIPPED_SUPERVISOR/);
  });

  it("returns nothing about the case when a skill test session starts", () => {
    const start = read("src/app/api/sessions/route.ts");
    const examResponse = start.slice(
      start.indexOf("  if (test) {\n    // Exam:"),
      start.indexOf("  return NextResponse.json({\n    sessionId: session.id,\n    language: caseResult"),
    );
    expect(examResponse).toContain("skillTestId: test.assignment.id");
    expect(examResponse).not.toMatch(/diagnosis|difficulty|assessmentId|caseInstanceId|template|preset/);
    // The row stores the case sealed, never a case_instances row.
    expect(start).toContain("insertPayload.sealed_case = sealedCase;");
    // Later sessions reuse the pinned blob verbatim (the trigger compares it).
    expect(start).toMatch(/test\.assignment\.sealed_case \?\?\s+sealSkillTestCase\(/);
    expect(start).toContain("persist: false,");
  });

  it("keeps the case off the trainee's session screen and coaching view", () => {
    const page = read("src/app/(app)/sessions/[id]/page.tsx");
    expect(page).toContain("avatar={traineeSafeAvatar(resolved)}");
    expect(page).toContain("session={traineeSafeSession(typed)}");
    const coach = read("src/app/api/sessions/[id]/supervisor/route.ts");
    expect(coach).toContain("session.skill_test_assignment_id");
  });

  it("gives trainees their tests without the case", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.my_skill_tests(");
    const policy = migration.slice(
      migration.indexOf('CREATE POLICY "Skill tests supervisor or admin select"'),
    );
    expect(policy.slice(0, policy.indexOf(";"))).not.toContain("trainee_id");
    const fn = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.my_skill_tests("),
    );
    const body = fn.slice(0, fn.indexOf("$$;"));
    expect(body).not.toMatch(/disorder_slug|comorbidity_slugs|a\.difficulty|a\.severity/);
  });

  it("does not list score dashboards in the trainee menu", () => {
    const shell = read("src/components/AppShell.tsx");
    const nav = shell.slice(
      shell.indexOf("function therapistNav("),
      shell.indexOf("function TherapistNavLink("),
    );
    expect(nav).not.toContain("/learning");
    expect(nav).toContain('"/tests"');
  });
});
