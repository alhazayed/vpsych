import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("Mission 14 DevOps invariants", () => {
  it("CI runs lint, typecheck, tests, migrations, audit, and build", () => {
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/npm run lint/);
    expect(ci).toMatch(/npm run typecheck/);
    expect(ci).toMatch(/npm test/);
    expect(ci).toMatch(/test:migrations/);
    expect(ci).toMatch(/npm run build/);
    expect(ci).toMatch(/npm audit --audit-level=high/);
    expect(ci).toMatch(/node-version:\s*24/);
    expect(ci).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(ci).toMatch(/cancel-in-progress:\s*true/);
  });

  it("ships Dependabot for npm and GitHub Actions", () => {
    const dep = readFileSync(join(root, ".github/dependabot.yml"), "utf8");
    expect(dep).toMatch(/package-ecosystem:\s*npm/);
    expect(dep).toMatch(/package-ecosystem:\s*github-actions/);
  });

  it("provides a production smoke harness", () => {
    expect(existsSync(join(root, "scripts/smoke-prod.mjs"))).toBe(true);
    const smoke = readFileSync(join(root, "scripts/smoke-prod.mjs"), "utf8");
    expect(smoke).toMatch(/\/api\/health/);
    expect(smoke).toMatch(/SMOKE_BASE_URL/);
  });

  it("revokes public execute on finish_session_on_report trigger helper", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260803050909_devops_revoke_trigger_rpc_grants.sql",
      ),
      "utf8",
    );
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.finish_session_on_report/);
    expect(migration).toMatch(/FROM anon/);
  });
});
