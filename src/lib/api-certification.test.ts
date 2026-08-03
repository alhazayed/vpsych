import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkRoutes(full, acc);
    else if (name === "route.ts") acc.push(full);
  }
  return acc;
}

describe("API certification inventory guards", () => {
  const apiRoot = join(process.cwd(), "src/app/api");
  const routes = walkRoutes(apiRoot);

  it("discovers the expected route surface", () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
  });

  it("every admin and health mutating surface rate-limits", () => {
    const mustLimit = routes.filter(
      (p) =>
        p.includes("/admin/") ||
        p.includes("/health/") ||
        p.includes("/sessions/") ||
        p.includes("/voice/") ||
        p.includes("/ace/") ||
        p.includes("/cge/"),
    );
    for (const file of mustLimit) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} missing rateLimit`).toMatch(/rateLimit\(/);
    }
  });

  it("middleware returns JSON 401 for unauthenticated /api/*", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(src).toMatch(/path\.startsWith\("\/api\/"\)/);
    expect(src).toMatch(/status:\s*401/);
    expect(src).toMatch(/Unauthorized/);
  });

  it("session end does not disclose privileged env var names", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/REPORT_WRITE_KEY/);
    expect(src).toMatch(/sanitizeDbError/);
  });

  it("ACE profile PATCH fails closed on DB error", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/ace/profile/route.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/source:\s*"memory"/);
    expect(src).toMatch(/Profile update failed/);
    expect(src).toMatch(/status:\s*500/);
  });
});
