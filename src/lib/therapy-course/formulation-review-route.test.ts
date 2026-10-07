/**
 * POST /api/admin/courses/[id]/formulation-review — admin-only, rate-limited,
 * and never rates a plan that has no 5 Ps.
 */
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const COURSE_ID = "11111111-2222-4333-8444-555555555555";

const auth = vi.hoisted(() => ({ ok: true as boolean }));
const limit = vi.hoisted(() => ({ ok: true as boolean }));
const course = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
const review = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  requireApiAdmin: vi.fn(async () =>
    auth.ok
      ? { ok: true, supabase: {}, user: { id: "admin-1" } }
      : { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) },
  ),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => (limit.ok ? { ok: true } : { ok: false, retryAfterSec: 60 })),
}));
vi.mock("@/lib/therapy-course", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/therapy-course")>()),
  loadCourseById: vi.fn(async () => course.value),
}));
vi.mock("@/lib/therapy-course/formulation-review", () => ({
  reviewFormulation: review,
}));

const { POST } = await import("@/app/api/admin/courses/[id]/formulation-review/route");

const fivePs = {
  presenting: "Worry and poor sleep.",
  predisposing: "Anxious since childhood.",
  precipitating: "Health scare.",
  perpetuating: "Reassurance seeking.",
  protective: "Supportive partner.",
};

function call(id = COURSE_ID, body: unknown = { language: "ar" }) {
  return POST(
    new Request(`http://localhost/api/admin/courses/${id}/formulation-review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  auth.ok = true;
  limit.ok = true;
  review.mockReset();
  course.value = {
    id: COURSE_ID,
    clinical_snapshot: { randomized_context: { recent_stressor: "a health scare" } },
    treatment_plan: { five_ps: fivePs },
  };
});

describe("formulation review route", () => {
  it("refuses non-admins", async () => {
    auth.ok = false;
    expect((await call()).status).toBe(403);
    expect(review).not.toHaveBeenCalled();
  });

  it("rate-limits with Retry-After", async () => {
    limit.ok = false;
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("rejects a malformed id and a missing course", async () => {
    expect((await call("not-a-uuid")).status).toBe(400);
    course.value = null;
    expect((await call()).status).toBe(404);
  });

  it("does not rate a plan written before the 5 Ps", async () => {
    course.value = { ...course.value, treatment_plan: { five_ps: null } };
    const res = await call();
    expect(res.status).toBe(409);
    expect(review).not.toHaveBeenCalled();
  });

  it("rates against the case key in the requested language", async () => {
    review.mockResolvedValue({ ok: true, review: { items: [] } });
    const res = await call();
    expect(res.status).toBe(200);
    const arg = review.mock.calls[0]?.[0];
    expect(arg.language).toBe("ar");
    expect(arg.trainee).toEqual(fivePs);
    expect(arg.key.precipitating).toEqual(["a health scare"]);
  });

  it("returns a safe 503 when the examiner is unavailable", async () => {
    review.mockResolvedValue({ ok: false, code: "AI_UNAVAILABLE" });
    const res = await call();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/key|openai|gateway/i);
  });
});
