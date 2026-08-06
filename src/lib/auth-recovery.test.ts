import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd());

describe("password recovery flow", () => {
  it("email hook links to app-hosted /auth/confirm (not GoTrue /verify)", () => {
    const hook = readFileSync(
      join(root, "supabase/functions/send-email-hook/index.ts"),
      "utf8",
    );
    expect(hook).toMatch(/function confirmUrl/);
    expect(hook).toMatch(/\/auth\/confirm/);
    expect(hook).toMatch(/token_hash: data\.token_hash/);
    expect(hook).toMatch(/isLoopbackHost/);
    expect(hook).toMatch(/vpsych\.vercel\.app/);
    // Must not build a GoTrue verify URL in code (comments may mention it).
    expect(hook).not.toMatch(
      /return `\$\{SUPABASE_URL\}\/auth\/v1\/verify/,
    );
  });

  it("exposes confirm + reset-password routes", () => {
    expect(() =>
      readFileSync(join(root, "src/app/auth/confirm/route.ts"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(
        join(root, "src/app/auth/reset-password/page-client.tsx"),
        "utf8",
      ),
    ).not.toThrow();
    const confirm = readFileSync(
      join(root, "src/app/auth/confirm/route.ts"),
      "utf8",
    );
    expect(confirm).toMatch(/verifyOtp/);
    expect(confirm).toMatch(/\/auth\/reset-password/);
  });

  it("forgot-password redirects to reset-password after callback", () => {
    const login = readFileSync(
      join(root, "src/app/login/page-client.tsx"),
      "utf8",
    );
    expect(login).toMatch(
      /auth\/callback\?next=\/auth\/reset-password/,
    );
    expect(login).not.toMatch(/auth\/callback\?next=\/login/);
  });

  it("middleware keeps /auth/* public and only bounces login/signup", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/path\.startsWith\("\/auth\/"\)/);
    // Exact assignment — login/signup only (comments may mention reset-password).
    expect(mw).toMatch(
      /const isAuthPage =\s*path\.startsWith\("\/login"\) \|\| path\.startsWith\("\/signup"\);/,
    );
  });
});
