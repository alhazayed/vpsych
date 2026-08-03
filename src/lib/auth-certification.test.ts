import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd());

describe("auth / authorization certification guards", () => {
  it("middleware returns JSON 401 for anonymous API access", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/path\.startsWith\("\/api\/"\)/);
    expect(mw).toMatch(/Unauthorized/);
    expect(mw).toMatch(/status: 401/);
  });

  it("middleware preserves deep-link query in login next= and honors safeRedirectPath when already authed", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/nextTarget/);
    expect(mw).toMatch(/request\.nextUrl\.search/);
    expect(mw).toMatch(/safeRedirectPath/);
  });

  it("middleware keeps edge admin RBAC for /admin and /api/admin", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/isAdminPath/);
    expect(mw).toMatch(/profileRole !== "admin"/);
    expect(mw).toMatch(/Forbidden/);
  });

  it("sets Secure on the locale cookie in production", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/secure:\s*process\.env\.NODE_ENV === "production"/);
  });

  it("TTS voice resolution allowlists client-supplied voice ids", () => {
    const resolve = readFileSync(
      join(root, "src/lib/voice/resolve-tts-voice.ts"),
      "utf8",
    );
    expect(resolve).toMatch(/loadAllowedVoiceIds/);
    expect(resolve).toMatch(/allowed\.has/);
  });

  it("migration fixes profiles UPDATE RLS recursion via current_user_role()", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260803170000_fix_profiles_update_rls_recursion.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/current_user_role\(\)/);
    expect(sql).toMatch(/Users can update own display name/);
  });

  it("page and API admin guards exist", () => {
    const page = readFileSync(join(root, "src/lib/auth.ts"), "utf8");
    const api = readFileSync(join(root, "src/lib/api-auth.ts"), "utf8");
    expect(page).toMatch(/export async function requireAdmin/);
    expect(api).toMatch(/export async function requireApiAdmin/);
    expect(api).toMatch(/profile\.role !== "admin"/);
  });
});
