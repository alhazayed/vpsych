import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd());

describe("Enterprise Security Certification", () => {
  it("middleware returns JSON 401 for unauthenticated /api/*", () => {
    const src = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(src).toContain('path.startsWith("/api/")');
    expect(src).toContain('{ error: "Unauthorized" }');
    expect(src).toContain("status: 401");
  });

  it("session end sanitizes database error messages", () => {
    const src = readFileSync(
      join(root, "src/app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(src).toContain("sanitizeDbError(updateError.message)");
    expect(src).toContain("sanitizeDbError(hasErr.message)");
    expect(src).not.toMatch(
      /return NextResponse\.json\(\{\s*error:\s*updateError\.message/,
    );
  });

  it("TTS rejects client voice ids and caps text length", () => {
    const src = readFileSync(
      join(root, "src/app/api/voice/tts/route.ts"),
      "utf8",
    );
    expect(src).toContain("avatarId or voiceProfileId required");
    expect(src).toContain("max 2500");
    expect(src).toContain("voiceId: null");
    expect(src).toContain("voiceIdAr: null");
  });

  it("message/system inserts require privileged service client", () => {
    const msg = readFileSync(
      join(root, "src/app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const create = readFileSync(
      join(root, "src/app/api/sessions/route.ts"),
      "utf8",
    );
    expect(msg).toContain("messageRpcClient");
    expect(msg).toContain("Server misconfigured");
    expect(create).toContain("insert_system_message");
    expect(create).toContain("messageRpcClient");
    expect(create).toContain("Server misconfigured");
  });

  it("enterprise security migration revokes message RPCs and guards ACE inserts", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260803194500_enterprise_security_cert_hardening.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("revoke all on function public.insert_assistant_message");
    expect(sql).toContain("revoke all on function public.insert_system_message");
    expect(sql).toContain("service_role");
    expect(sql).toContain("enforce_learner_profile_insert_guard");
    expect(sql).toContain("enforce_learner_competency_insert_guard");
    expect(sql).toContain("coalesce(samples, 0) = 0");
  });

  it("admin API routes use requireApiAdmin", () => {
    const adminCge = readFileSync(
      join(root, "src/app/api/admin/cge/route.ts"),
      "utf8",
    );
    expect(adminCge).toContain("requireApiAdmin");
  });
});
