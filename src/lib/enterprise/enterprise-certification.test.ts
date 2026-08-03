/**
 * Mission 18 — Institutional & Enterprise Certification suite.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTERPRISE_MEMBERSHIP_ROLES,
  buildAnonymousResearchExport,
  assertNoPiiKeys,
  buildInstitutionAnalytics,
  canAct,
  canPermissionOnInstitution,
  filterByTenant,
  assertSameTenant,
  getBuiltinInstitutionTree,
  isSuperAdministrator,
  membershipRoleFromProfession,
  runEnterpriseCertification,
  evaluateSsoReadiness,
  SSO_INTEGRATION_CONTRACT,
  assessCompliance,
  assessScaleTier,
} from "@/lib/enterprise";

const ARTIFACT_DIR =
  process.env.VPSYCH_ENTERPRISE_OUT ||
  "/opt/cursor/artifacts/enterprise-cert";

function ensureDir() {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch {
    /* optional */
  }
}

describe("Mission 18 — Enterprise Institutional Certification", () => {
  it("models full institution hierarchy", () => {
    const tree = getBuiltinInstitutionTree();
    expect(tree.institution.slug).toBe("vpsych-demo-university");
    expect(tree.departments.length).toBeGreaterThan(0);
    expect(tree.programs.length).toBeGreaterThan(0);
    expect(tree.academic_years.length).toBeGreaterThan(0);
    expect(tree.terms.length).toBeGreaterThan(0);
    expect(tree.cohorts.length).toBeGreaterThan(0);
    expect(tree.classes.length).toBeGreaterThan(0);
    expect(tree.assignments.some((a) => a.is_required && a.due_at)).toBe(true);
    expect(tree.assignments.some((a) => a.is_elective)).toBe(true);
  });

  it("covers enterprise roles including Super Administrator mapping", () => {
    expect(ENTERPRISE_MEMBERSHIP_ROLES).toHaveLength(8);
    expect(isSuperAdministrator("admin")).toBe(true);
    expect(isSuperAdministrator("therapist")).toBe(false);
    expect(canAct("admin", [], "research.export")).toBe(true);
    expect(canAct("therapist", ["student"], "research.export")).toBe(false);
    expect(canAct("therapist", ["institution_admin"], "institution.write")).toBe(
      true,
    );
    expect(membershipRoleFromProfession("psychiatry_resident")).toBe("resident");
    expect(membershipRoleFromProfession("medical_student")).toBe("student");
    expect(membershipRoleFromProfession("general_practitioner")).toBe("gp");
  });

  it("enforces tenant isolation helpers", () => {
    const tree = getBuiltinInstitutionTree();
    expect(assertSameTenant("a", "b").ok).toBe(false);
    expect(assertSameTenant(tree.institution.id, tree.institution.id).ok).toBe(
      true,
    );
    const filtered = filterByTenant(
      {
        platformRole: "therapist",
        memberships: [
          {
            id: "m1",
            institution_id: tree.institution.id,
            user_id: "u",
            role: "resident",
            is_primary: true,
            is_active: true,
          },
        ],
      },
      [
        { institution_id: tree.institution.id, n: 1 },
        { institution_id: "foreign", n: 2 },
      ],
    );
    expect(filtered).toEqual([{ institution_id: tree.institution.id, n: 1 }]);
    expect(
      canPermissionOnInstitution(
        {
          platformRole: "therapist",
          memberships: [
            {
              id: "m2",
              institution_id: tree.institution.id,
              user_id: "f",
              role: "faculty",
              is_primary: true,
              is_active: true,
            },
          ],
        },
        tree.institution.id,
        "analytics.class",
      ),
    ).toBe(true);
  });

  it("computes institution analytics including at-risk learners", () => {
    const tree = getBuiltinInstitutionTree();
    const analytics = buildInstitutionAnalytics({
      institution_id: tree.institution.id,
      assignments: tree.assignments,
      completions: [
        {
          id: "1",
          assignment_id: tree.assignments[0]!.id,
          user_id: "a",
          status: "passed",
          attempt_number: 1,
          score: 90,
        },
        {
          id: "2",
          assignment_id: tree.assignments[0]!.id,
          user_id: "b",
          status: "failed",
          attempt_number: 1,
          score: 40,
        },
      ],
      learners: [
        {
          user_id: "a",
          scores: [90],
          competency_scores: { safety: 90 },
          completed_required: 1,
          total_required: 1,
        },
        {
          user_id: "b",
          scores: [40],
          competency_scores: { safety: 40 },
          completed_required: 1,
          total_required: 1,
        },
        {
          user_id: "c",
          scores: [],
          completed_required: 0,
          total_required: 1,
        },
      ],
    });
    expect(analytics.pass_rate).toBeGreaterThan(0);
    expect(analytics.at_risk_learners.length).toBeGreaterThan(0);
    expect(analytics.competency_distribution.safety?.n).toBe(2);
  });

  it("produces anonymous research exports without PII keys", () => {
    const payload = buildAnonymousResearchExport(
      [
        {
          user_id: "uuid-user-1",
          session_id: "sess-1",
          locale: "ar-JO",
          overall_score: 71,
          competency_scores: { communication: 70 },
          started_at: "2026-02-01T00:00:00.000Z",
        },
        {
          user_id: "uuid-user-1",
          session_id: "sess-2",
          locale: "ar-JO",
          overall_score: 80,
          started_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      {
        salt: "institution-research-key",
        version_lock: "m18-test",
        include_competency_scores: true,
      },
    );
    expect(payload.row_count).toBe(2);
    expect(payload.rows[0]!.subject_id).not.toContain("uuid-user");
    expect(payload.rows[1]!.session_ordinal).toBe(2);
    expect(assertNoPiiKeys(payload)).toEqual([]);
  });

  it("documents SSO readiness contract", () => {
    expect(SSO_INTEGRATION_CONTRACT.supported).toContain("oidc");
    expect(SSO_INTEGRATION_CONTRACT.supported).toContain("saml");
    const readiness = evaluateSsoReadiness(
      { enabled: false, provider: "none" },
      { supabaseUrlConfigured: true, authExternalProvidersDocumented: true },
    );
    expect(readiness.score).toBeGreaterThanOrEqual(80);
  });

  it("assesses compliance without claiming HIPAA certification", () => {
    const c = assessCompliance();
    expect(c.hipaa_certified).toBe(false);
    expect(c.scores.INSTITUTIONAL_PRIVACY).toBeGreaterThan(50);
    expect(c.controls.some((x) => x.id === "gdpr-minimisation")).toBe(true);
  });

  it("assesses scalability tiers", () => {
    const s = assessScaleTier({
      rateLimitConfigured: true,
      upstashConfigured: true,
      tenantIsolation: true,
      pagination: false,
      indexesPresent: true,
      multiInstanceSafe: true,
    });
    expect(s["100"].ready).toBe(true);
    expect(s.multi_institution.ready).toBe(true);
    expect(s["10000"].ready).toBe(false); // pagination blocker
  });

  it("exposes public /api/health without auth gate", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/health/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/status:\s*"ok"/);
    expect(route).not.toMatch(/requireApiAdmin|requireApiUser/);
  });

  it("includes enterprise migration with tenant RLS helpers", () => {
    const mig = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260803180000_enterprise_institutional_foundation.sql",
      ),
      "utf8",
    );
    expect(mig).toMatch(/create table if not exists public\.institutions/i);
    expect(mig).toMatch(/enterprise_membership_role/);
    expect(mig).toMatch(/learning_assignments/);
    expect(mig).toMatch(/is_institution_member/);
    expect(mig).toMatch(/can_manage_institution/);
    expect(mig).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it("runs board certification and writes artifacts", () => {
    const result = runEnterpriseCertification({
      publicHealthEndpoint: true,
      upstashConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    });
    expect(result.phases).toHaveLength(10);
    expect(result.institutional_score).toBeGreaterThanOrEqual(70);
    expect(result.verdict).not.toBe("ENTERPRISE_CERTIFICATION_FAILED");
    expect(result.phases.every((p) => p.status !== "fail")).toBe(true);

    ensureDir();
    try {
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "enterprise-board.json"),
        JSON.stringify(result, null, 2),
      );
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, "phase-matrix.json"),
        JSON.stringify(result.phases, null, 2),
      );
    } catch {
      /* optional */
    }
  });
});
