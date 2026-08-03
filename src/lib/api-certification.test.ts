import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRoutes(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

describe("API certification guards", () => {
  it("middleware returns JSON 401 for anonymous /api access", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/path\.startsWith\("\/api\/"\)/);
    expect(mw).toMatch(/Unauthorized/);
    expect(mw).toMatch(/status: 401/);
    expect(mw).toMatch(/NextResponse\.json/);
  });

  it("middleware keeps edge admin deny for /api/admin", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/isAdminPath/);
    expect(mw).toMatch(/profileRole !== "admin"/);
    expect(mw).toMatch(/Forbidden/);
  });

  it("TTS resolves client voice ids against an allowlist", () => {
    const resolve = readFileSync(
      join(root, "src/lib/voice/resolve-tts-voice.ts"),
      "utf8",
    );
    expect(resolve).toMatch(/loadAllowedVoiceIds/);
    expect(resolve).toMatch(/allowed\.has/);
  });

  it("session end and admin mutate routes sanitize DB errors to clients", () => {
    const end = readFileSync(
      join(root, "src/app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const templates = readFileSync(
      join(root, "src/app/api/admin/templates/route.ts"),
      "utf8",
    );
    const presets = readFileSync(
      join(root, "src/app/api/admin/presets/route.ts"),
      "utf8",
    );
    expect(end).toMatch(/sanitizeDbError\(updateError\.message\)/);
    expect(end).toMatch(/sanitizeDbError\(hasErr\.message\)/);
    expect(templates).toMatch(/sanitizeDbError\(cloneErr\.message\)/);
    expect(templates).toMatch(/sanitizeDbError\(createErr\.message\)/);
    expect(presets).toMatch(/sanitizeDbError\(verErr\.message\)/);
    expect(presets).toMatch(/sanitizeDbError\(updErr\.message\)/);
    // No unsanitized client returns of raw Postgres messages in these files.
    for (const src of [end, templates, presets]) {
      expect(src).not.toMatch(
        /return NextResponse\.json\(\{\s*error:\s*(updateError|hasErr|cloneErr|createErr|verErr|updErr)\.message/,
      );
    }
  });

  it("every API route authenticates (user check or requireApiAdmin/User)", () => {
    const routes = walkRoutes(join(root, "src/app/api"));
    expect(routes.length).toBeGreaterThanOrEqual(20);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const gated =
        src.includes("requireApiAdmin") ||
        src.includes("requireApiUser") ||
        src.includes('error: "Unauthorized"') ||
        src.includes("getUser()");
      expect(gated, `${file} missing auth gate`).toBe(true);
    }
  });

  it("admin API routes use requireApiAdmin", () => {
    const routes = walkRoutes(join(root, "src/app/api/admin"));
    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} missing requireApiAdmin`).toMatch(/requireApiAdmin/);
    }
  });
});
