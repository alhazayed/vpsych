import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioural tests for the edge gate: sign-in redirect, approval gate, admin
// gate and locale cookie. Supabase is replaced with a stub that returns the
// user and profile each test sets up.

type Profile = {
  preferred_language?: string | null;
  role?: string | null;
  approval_status?: string | null;
} | null;

const state: {
  user: { id: string } | null;
  profile: Profile;
  profileError: { code?: string; message?: string } | null;
  profileReads: number;
} = { user: null, profile: null, profileError: null, profileReads: 0 };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            state.profileReads += 1;
            return { data: state.profile, error: state.profileError };
          },
        }),
      }),
    }),
  }),
}));

const { updateSession } = await import("./middleware");

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, "https://vpsych.test"));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function location(res: Response): string | null {
  const loc = res.headers.get("location");
  if (!loc) return null;
  const url = new URL(loc);
  return `${url.pathname}${url.search}`;
}

beforeEach(() => {
  state.user = null;
  state.profile = null;
  state.profileError = null;
  state.profileReads = 0;
});

describe("updateSession: signed out", () => {
  it("redirects a protected page to /login and keeps the target in next", async () => {
    const res = await updateSession(request("/sessions/abc?tab=report"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe(
      `/login?next=${encodeURIComponent("/sessions/abc?tab=report")}`,
    );
  });

  it("returns JSON 401 for a protected API instead of redirecting", async () => {
    const res = await updateSession(request("/api/sessions"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("lets public pages through", async () => {
    for (const path of ["/", "/login", "/signup", "/auth/callback", "/privacy"]) {
      const res = await updateSession(request(path, { locale: "en" }));
      expect(res.headers.get("location"), path).toBeNull();
      expect(res.status, path).toBe(200);
    }
  });

  it("answers /api/health without touching Supabase", async () => {
    const res = await updateSession(request("/api/health"));
    expect(res.status).toBe(200);
    expect(state.profileReads).toBe(0);
  });
});

describe("updateSession: approval gate", () => {
  beforeEach(() => {
    state.user = { id: "u1" };
  });

  it("sends a pending account to the pending screen", async () => {
    state.profile = { role: "therapist", approval_status: "pending" };
    const res = await updateSession(request("/avatars", { locale: "en" }));
    expect(location(res)).toBe("/pending");
  });

  it("sends a rejected account to the pending screen", async () => {
    state.profile = { role: "therapist", approval_status: "rejected" };
    const res = await updateSession(request("/sessions/abc", { locale: "en" }));
    expect(location(res)).toBe("/pending");
  });

  it("returns 403 ACCOUNT_NOT_APPROVED on APIs for a pending account", async () => {
    state.profile = { role: "therapist", approval_status: "pending" };
    const res = await updateSession(request("/api/sessions", { locale: "en" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "ACCOUNT_NOT_APPROVED" });
  });

  it("fails closed with 503 when the profile can't be read", async () => {
    state.profileError = { code: "500", message: "db down" };
    const res = await updateSession(request("/api/sessions", { locale: "en" }));
    expect(res.status).toBe(503);
  });

  it("lets a pending account reach the pending screen itself", async () => {
    state.profile = { role: "therapist", approval_status: "pending" };
    const res = await updateSession(request("/pending", { locale: "en" }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("lets an approved account through", async () => {
    state.profile = { role: "therapist", approval_status: "approved" };
    const res = await updateSession(request("/avatars", { locale: "en" }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("treats a missing approval column as approved (pre-migration)", async () => {
    state.profileError = { code: "42703", message: 'column "approval_status" does not exist' };
    state.profile = { role: "therapist" };
    const res = await updateSession(request("/avatars", { locale: "en" }));
    // The stub returns the same error on the fallback read, so only the
    // approval decision is under test here.
    expect(location(res)).not.toBe("/pending");
  });
});

describe("updateSession: admin gate", () => {
  beforeEach(() => {
    state.user = { id: "u1" };
  });

  it("redirects a non-admin away from /admin", async () => {
    state.profile = { role: "therapist", approval_status: "approved" };
    const res = await updateSession(request("/admin/reports", { locale: "en" }));
    expect(location(res)).toBe("/avatars");
  });

  it("returns 403 on /api/admin for a non-admin", async () => {
    state.profile = { role: "therapist", approval_status: "approved" };
    const res = await updateSession(request("/api/admin/reports", { locale: "en" }));
    expect(res.status).toBe(403);
  });

  it("lets an approved admin into /admin", async () => {
    state.profile = { role: "admin", approval_status: "approved" };
    const res = await updateSession(request("/admin/reports", { locale: "en" }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("treats admins as approved whatever approval_status says", async () => {
    // resolveApprovalStatus: admins are always approved (they run approvals).
    state.profile = { role: "admin", approval_status: "pending" };
    const res = await updateSession(request("/admin/reports", { locale: "en" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends a signed-in user with no profile row to the pending screen", async () => {
    state.profile = null;
    const res = await updateSession(request("/admin/reports", { locale: "en" }));
    expect(location(res)).toBe("/pending");
  });
});

describe("updateSession: signed in on auth pages", () => {
  beforeEach(() => {
    state.user = { id: "u1" };
    state.profile = { role: "therapist", approval_status: "approved" };
  });

  it("bounces /login to a safe next target", async () => {
    const res = await updateSession(request("/login?next=/sessions/abc", { locale: "en" }));
    expect(location(res)).toBe("/sessions/abc");
  });

  it("refuses an off-site next target", async () => {
    const res = await updateSession(
      request("/login?next=https://evil.example/x", { locale: "en" }),
    );
    const loc = res.headers.get("location") ?? "";
    expect(new URL(loc).host).toBe("vpsych.test");
  });
});

describe("updateSession: locale cookie", () => {
  beforeEach(() => {
    state.user = { id: "u1" };
  });

  it("keeps an explicit cookie over the profile language", async () => {
    state.profile = {
      role: "therapist",
      approval_status: "approved",
      preferred_language: "en",
    };
    const res = await updateSession(request("/avatars", { locale: "ar" }));
    expect(res.cookies.get("locale")).toBeUndefined();
  });

  it("sets the cookie from the profile when none is present", async () => {
    state.profile = {
      role: "therapist",
      approval_status: "approved",
      preferred_language: "ar",
    };
    const res = await updateSession(request("/avatars"));
    expect(res.cookies.get("locale")?.value).toBe("ar");
  });
});
