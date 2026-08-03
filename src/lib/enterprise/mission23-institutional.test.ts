import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runAllInstitutionSimulations } from "./simulations";
import { runEnterpriseCertification } from "./score";
import {
  canPermissionOnInstitution,
  filterByTenant,
  assertSameTenant,
} from "./tenant";
import type { TenantContext } from "./tenant";

describe("Mission 23 — Institutional Certification", () => {
  it("runs University / Teaching Hospital / Private / Government simulations", () => {
    const { results, allPassed } = runAllInstitutionSimulations();
    expect(results).toHaveLength(4);
    expect(allPassed).toBe(true);
    for (const r of results) {
      expect(r.ok).toBe(true);
      expect(r.checks.tenant_filter_excludes_foreign).toBe(true);
      expect(r.checks.cross_tenant_assert).toBe(true);
      expect(r.checks.research_no_pii).toBe(true);
    }

    const outDir = "/opt/cursor/artifacts/institutional-cert";
    try {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, "institution-simulations.json"),
        JSON.stringify(
          { generatedAt: new Date().toISOString(), results },
          null,
          2,
        ),
      );
    } catch {
      /* optional */
    }
  });

  it("denies cross-tenant faculty access", () => {
    const ctx: TenantContext = {
      platformRole: "therapist",
      memberships: [
        {
          id: "m1",
          institution_id: "inst-a",
          user_id: "u1",
          role: "faculty",
          is_primary: true,
          is_active: true,
        },
      ],
    };
    expect(
      canPermissionOnInstitution(ctx, "inst-a", "assignment.manage"),
    ).toBe(true);
    expect(
      canPermissionOnInstitution(ctx, "inst-b", "assignment.manage"),
    ).toBe(false);
    expect(
      filterByTenant(ctx, [
        { institution_id: "inst-a" },
        { institution_id: "inst-b" },
      ]),
    ).toEqual([{ institution_id: "inst-a" }]);
    expect(assertSameTenant("inst-a", "inst-b").ok).toBe(false);
  });

  it("keeps Mission 18 enterprise board above institutional threshold", () => {
    const result = runEnterpriseCertification({
      publicHealthEndpoint: true,
      upstashConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    });
    expect(result.institutional_score).toBeGreaterThanOrEqual(70);
    expect(result.verdict).not.toBe("ENTERPRISE_CERTIFICATION_FAILED");
  });

  it("exposes faculty APIs and session tenancy migration", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = process.cwd();
    expect(
      existsSync(join(root, "src/app/api/faculty/institutions/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(root, "src/app/api/faculty/assignments/route.ts")),
    ).toBe(true);
    expect(
      existsSync(join(root, "src/app/api/faculty/research/export/route.ts")),
    ).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/faculty/page.tsx"))).toBe(true);
    const mig = readFileSync(
      join(
        root,
        "supabase/migrations/20260803220000_institutional_session_tenancy.sql",
      ),
      "utf8",
    );
    expect(mig).toMatch(/sessions[\s\S]*institution_id/);
    expect(mig).toMatch(/state-medical-university/);
    expect(mig).toMatch(/metro-teaching-hospital/);
    expect(mig).toMatch(/harbor-private-college/);
    expect(mig).toMatch(/national-moh-training/);

    const research = readFileSync(
      join(root, "src/app/api/admin/research/export/route.ts"),
      "utf8",
    );
    expect(research).toMatch(/refusing unscoped global session dump/);
  });
});
