import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("supabase certification guards", () => {
  it("revokes authenticated EXECUTE on ACE progress and message forge RPCs", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260803172000_supabase_cert_revoke_privileged_rpcs.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/apply_ace_session_progress/);
    expect(sql).toMatch(/insert_assistant_message/);
    expect(sql).toMatch(/insert_system_message/);
    expect(sql).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]*TO service_role/);
  });

  it("persists ACE scoring via service-role apply_ace_session_progress RPC", () => {
    const persist = readFileSync(
      join(root, "src/lib/ace/persist.ts"),
      "utf8",
    );
    expect(persist).toMatch(/createServiceClient/);
    expect(persist).toMatch(/apply_ace_session_progress/);
    expect(persist).not.toMatch(
      /\.from\("learner_profiles"\)\s*\n\s*\.update\(\{\s*\n\s*completed_case_count/,
    );
  });

  it("keeps profiles UPDATE RLS recursion fix migration in repo", () => {
    const sql = readFileSync(
      join(
        root,
        "supabase/migrations/20260803164011_fix_profiles_update_rls_recursion.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/current_user_role\(\)/);
  });

  it("session message routes use privileged service client for assistant/system RPCs", () => {
    const message = readFileSync(
      join(root, "src/app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const create = readFileSync(
      join(root, "src/app/api/sessions/route.ts"),
      "utf8",
    );
    expect(message).toMatch(/createServiceClient/);
    expect(message).toMatch(/insert_assistant_message/);
    expect(create).toMatch(/insert_system_message/);
  });
});
