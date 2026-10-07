/**
 * Route-level tests for therapy courses.
 *
 * Real: POST /api/sessions, the message route and prepareClinicalTurn, the
 * therapy-course gate. Faked: Supabase, rate limiter, case minting, model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, fakeSupabase, post } from "@/lib/sessions/__fixtures__/route-fakes";
import type { TreatmentPlan } from "@/lib/types";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const AVATAR_ID = "00000000-0000-4000-8000-000000000002";
const CASE_ID = "44444444-4444-4444-8444-444444444444";

const state = vi.hoisted(() => ({
  supabase: null as unknown,
  mintCalls: 0,
  detailed: [] as Array<(input: Record<string, unknown>) => unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));
vi.mock("@/lib/case-engine/persist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/case-engine/persist")>()),
  createCaseForSession: vi.fn(async () => {
    state.mintCalls += 1;
    return {
      ok: true,
      caseInstanceId: CASE_ID,
      snapshot: snapshot(),
      difficulty: "intermediate",
      therapyModality: "cbt",
    };
  }),
}));
vi.mock("@/lib/ai/patient-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/patient-agent")>();
  return {
    ...actual,
    generatePatientReplyDetailed: vi.fn(async (input: Record<string, unknown>) => {
      const next = state.detailed.shift();
      if (!next) throw new Error("unexpected generation");
      return next(input);
    }),
  };
});

function snapshot() {
  return {
    version: 2,
    assessment_id: "VPSY-ASM-TEST",
    case_instance_id: CASE_ID,
    locale: "en-US",
    difficulty: "intermediate",
    therapy_modality: "cbt",
    primary_diagnosis: { name: "Panic disorder", slug: "panic-disorder" },
    clinical_core: {},
  };
}

const plan: TreatmentPlan = {
  formulation: "Panic maintained by catastrophic interpretation and avoidance.",
  goals: ["Ride the metro to work again"],
  interventions: "CBT for panic with graded exposure.",
  expected_sessions: 6,
  patient_expectations: "Weekly sessions with practice at home.",
  risk_formulation: "No current risk; review if sleep worsens.",
  five_ps: null,
};

type Course = Record<string, unknown>;

/** In-memory DB covering the tables the start route touches. */
function startDb(opts: { course?: Course | null; courseSessions?: number; coursesTable?: boolean }) {
  const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
  const coursesTable = opts.coursesTable ?? true;
  const from = (table: string) => {
    let op = "select";
    let payload: Record<string, unknown> | null = null;
    const resolve = () => {
      if (table === "avatars") {
        return {
          data: { id: AVATAR_ID, name: "Maya", is_active: true, language: "en-US" },
          error: null,
        };
      }
      if (table === "profiles") return { data: { preferred_language: "en-US" }, error: null };
      if (table === "therapy_courses") {
        if (!coursesTable) {
          return { data: null, error: { code: "42P01", message: "relation \"therapy_courses\" does not exist" } };
        }
        if (op === "insert" && payload) {
          inserted.push({ table, row: payload });
          return { data: { id: "course-new", ...payload, treatment_plan: null }, error: null };
        }
        return { data: opts.course ?? null, error: null };
      }
      if (table === "sessions" && op === "insert" && payload) {
        inserted.push({ table, row: payload });
        return { data: { id: "session-new" }, error: null };
      }
      if (table === "sessions" && op === "select") {
        return {
          data: Array.from({ length: opts.courseSessions ?? 0 }, () => ({ status: "completed" })),
          error: null,
        };
      }
      if (op === "upsert" && payload) inserted.push({ table, row: payload });
      return { data: null, error: null };
    };
    const api: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) api[m] = () => api;
    for (const m of ["insert", "upsert", "update"]) {
      api[m] = (row: Record<string, unknown>) => {
        op = m;
        payload = row;
        return api;
      };
    }
    api.single = async () => resolve();
    api.maybeSingle = async () => resolve();
    api.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(ok, err);
    return api;
  };
  return {
    inserted,
    client: {
      auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
      from,
      rpc: async () => ({ data: null, error: null }),
    },
  };
}

function activeCourse(over: Course = {}): Course {
  return {
    id: "course-1",
    therapist_id: USER_ID,
    avatar_id: AVATAR_ID,
    case_instance_id: CASE_ID,
    clinical_snapshot: snapshot(),
    language: "en-US",
    max_duration_sec: 2400,
    status: "active",
    planned_sessions: 8,
    treatment_plan: null,
    ...over,
  };
}

function start(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatarId: AVATAR_ID, ...body }),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("REPORT_WRITE_KEY", "unit-test-report-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.mintCalls = 0;
  state.detailed = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/sessions with therapy courses", () => {
  it("first plain start mints a case and opens a course at session 1", async () => {
    const db = startDb({ course: null });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start());
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ courseId: "course-new", courseSessionNumber: 1 });
    expect(state.mintCalls).toBe(1);
    const session = db.inserted.find((i) => i.table === "sessions")!.row;
    expect(session).toMatchObject({ therapy_course_id: "course-new", course_session_number: 1 });
    expect((session.clinical_snapshot as Record<string, unknown>).therapy_course).toMatchObject({
      session_number: 1,
      planned_sessions: 8,
      // Session Practice Engine: questionnaire baseline frozen at session 1.
      self_report: { trend: "baseline" },
      previous_homework: null,
    });
    // The course stores the base case without per-session context.
    const course = db.inserted.find((i) => i.table === "therapy_courses")!.row;
    expect((course.clinical_snapshot as Record<string, unknown>).therapy_course).toBeUndefined();
  });

  it("session 2 reuses the pinned case instead of minting a new one", async () => {
    const db = startDb({ course: activeCourse(), courseSessions: 1 });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start({ locale: "ar" }));
    expect(res.status).toBe(200);
    expect(state.mintCalls).toBe(0);
    const session = db.inserted.find((i) => i.table === "sessions")!.row;
    expect(session).toMatchObject({
      case_instance_id: CASE_ID,
      therapy_course_id: "course-1",
      course_session_number: 2,
      // The patient's personality locale stays fixed for the course.
      language: "en-US",
    });
    // Existing case memory is kept, not reseeded.
    expect(db.inserted.some((i) => i.table === "case_memory")).toBe(false);
  });

  it("blocks session 3 until the treatment plan is written", async () => {
    state.supabase = startDb({ course: activeCourse(), courseSessions: 2 }).client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: "treatment_plan_required",
      courseId: "course-1",
    });
    expect(state.mintCalls).toBe(0);
  });

  it("session 3 carries the treatment plan once it exists", async () => {
    const db = startDb({
      course: activeCourse({
        treatment_plan: plan,
        planned_sessions: 6,
        plan_updated_at: "2026-10-04T10:00:00Z",
      }),
      courseSessions: 2,
    });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start());
    expect(res.status).toBe(200);
    const snap = db.inserted.find((i) => i.table === "sessions")!.row
      .clinical_snapshot as Record<string, unknown>;
    expect(snap.therapy_course).toMatchObject({
      session_number: 3,
      planned_sessions: 6,
      is_final_session: false,
      treatment_plan: plan,
      // First session after the plan: the trainee presents and negotiates it.
      plan_is_new: true,
    });
  });

  it("explicit case requests stay standalone sessions", async () => {
    const db = startDb({ course: activeCourse(), courseSessions: 2 });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start({ presetSlug: "anything" }));
    expect(res.status).toBe(200);
    expect(state.mintCalls).toBe(1);
    const session = db.inserted.find((i) => i.table === "sessions")!.row;
    expect(session.therapy_course_id).toBeUndefined();
  });

  it("works exactly as before when the courses table is missing", async () => {
    const db = startDb({ coursesTable: false });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(start());
    expect(res.status).toBe(200);
    expect(state.mintCalls).toBe(1);
    const session = db.inserted.find((i) => i.table === "sessions")!.row;
    expect(session.therapy_course_id).toBeUndefined();
    expect((session.clinical_snapshot as Record<string, unknown>).therapy_course).toBeUndefined();
    expect((await res.json()) as Record<string, unknown>).toMatchObject({ courseId: null });
  });
});

describe("patient turn inside a therapy course", () => {
  it("the patient prompt carries the session number and the plan", async () => {
    vi.stubEnv("CBE_ENABLED", "false");
    const db = fakeSupabase({
      snapshot: {
        therapy_course: {
          course_id: "course-1",
          session_number: 3,
          planned_sessions: 6,
          is_final_session: false,
          treatment_plan: plan,
        },
      },
    });
    state.supabase = db.client;
    const seen: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (seen.push(i), { text: "About the metro goal…", aiSource: "gpt" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const res = await POST(post("message", { message: "How was your week?" }), ctx);
    expect(res.status).toBe(200);
    const prompt = String((seen[0]!.avatar as { system_prompt: string }).system_prompt);
    expect(prompt).toContain("This is session 3");
    expect(prompt).toContain("Ride the metro to work again");
  });

  it("standalone sessions get no course block", async () => {
    vi.stubEnv("CBE_ENABLED", "false");
    state.supabase = fakeSupabase().client;
    const seen: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (seen.push(i), { text: "I worry.", aiSource: "gpt" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    await POST(post("message", { message: "What brings you in?" }), ctx);
    const prompt = String((seen[0]!.avatar as { system_prompt: string }).system_prompt);
    expect(prompt).not.toContain("THERAPY COURSE");
  });
});
