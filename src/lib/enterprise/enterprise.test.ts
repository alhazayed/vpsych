/**
 * Stage 10 — Enterprise Platform tests.
 * Isolation · security · RBAC · courses · certificates · performance · regression.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  ANALYTICS_SCOPES,
  CERTIFICATE_KINDS,
  ENTERPRISE_FORBIDDEN_WRITES,
  ENTERPRISE_OWNERSHIP_RULE,
  ENTERPRISE_REST_ROUTES,
  ENTERPRISE_VERSION,
  HIERARCHY_LABELS,
  PERFORMANCE_ENVELOPE,
  TENANT_TYPES,
  activateStudy,
  addLibraryEntry,
  addParticipatingOrg,
  approveLibrary,
  assertPermission,
  assertTenantAccess,
  attachLesson,
  authorizeTenantAction,
  boardPrepProgress,
  buildAnalyticsDashboard,
  buildEnterpriseAdminOverview,
  buildEnterpriseVersionLock,
  buildExportManifest,
  buildLongitudinalTrack,
  buildObservabilitySnapshot,
  buildOrgHierarchy,
  buildSecurityDashboard,
  canOrgAccessStudy,
  canReadLibrary,
  clearEnterpriseStoreForTests,
  createCourse,
  createGraduationRequirement,
  createLearningPath,
  createLesson,
  createLibrary,
  createModule,
  createResearchStudy,
  createRotation,
  createWebhookEndpoint,
  defaultAuthPolicy,
  enableSso,
  evaluateGraduation,
  evaluateOscePass,
  hasPermission,
  hierarchySummary,
  integrationCatalog,
  isolateByOrganization,
  issueCertificate,
  listAllCertificates,
  listEnterpriseRoles,
  mapLegacyMembershipRole,
  organizationFromInstitutionRow,
  permissionsFor,
  platformRoleToEnterprise,
  publishCourse,
  publishEntry,
  rbacMatrix,
  revokeCertificate,
  runEnterpriseEngine,
  secretRef,
  sessionStillValid,
  signWebhookPayload,
  storeCertificate,
  submitForApproval,
  verifyCertificate,
  verifyMutualIsolation,
} from "@/lib/enterprise";

const ORG_A = "org-a-0000-0000-0000-000000000001";
const ORG_B = "org-b-0000-0000-0000-000000000002";

beforeEach(() => {
  clearEnterpriseStoreForTests();
});

describe("Stage 10 enterprise ownership", () => {
  it("locks version and ownership rule", () => {
    expect(ENTERPRISE_VERSION).toBe("10.0.0");
    expect(ENTERPRISE_OWNERSHIP_RULE).toMatch(/Never owns Patient/i);
    expect(ENTERPRISE_FORBIDDEN_WRITES).toContain("clinical_snapshot");
    expect(ENTERPRISE_FORBIDDEN_WRITES).toContain("case_memory");
    expect(ENTERPRISE_FORBIDDEN_WRITES).toContain("DecisionPlan");
    const lock = buildEnterpriseVersionLock({ computed_at: "2026-08-07T00:00:00Z" });
    expect(lock.enterprise_version).toBe("10.0.0");
  });
});

describe("tenant isolation", () => {
  it("supports all tenant types", () => {
    expect(TENANT_TYPES).toHaveLength(6);
  });

  it("denies cross-tenant access for org roles", () => {
    const check = assertTenantAccess({
      actorRole: "faculty",
      actorOrganizationId: ORG_A,
      resourceOrganizationId: ORG_B,
      permission: "courses.read",
    });
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("cross_tenant"))).toBe(true);
  });

  it("allows platform global admin cross-tenant with permission", () => {
    const check = assertTenantAccess({
      actorRole: "global_admin",
      actorOrganizationId: ORG_A,
      resourceOrganizationId: ORG_B,
      permission: "analytics.executive",
    });
    expect(check.ok).toBe(true);
  });

  it("isolates row sets between tenants", () => {
    const rowsA = [
      { organization_id: ORG_A, id: "1" },
      { organization_id: ORG_A, id: "2" },
    ];
    const rowsB = [
      { organization_id: ORG_B, id: "3" },
      { organization_id: ORG_B, id: "4" },
    ];
    expect(isolateByOrganization(rowsA, ORG_B)).toHaveLength(0);
    expect(isolateByOrganization([...rowsA, ...rowsB], ORG_A)).toHaveLength(2);
    const mutual = verifyMutualIsolation({
      tenantA: ORG_A,
      tenantB: ORG_B,
      rowsA,
      rowsB,
    });
    expect(mutual.ok).toBe(true);
  });

  it("detects isolation leaks", () => {
    const leaked = verifyMutualIsolation({
      tenantA: ORG_A,
      tenantB: ORG_B,
      rowsA: [{ organization_id: ORG_B }],
      rowsB: [{ organization_id: ORG_A }],
    });
    expect(leaked.ok).toBe(false);
  });
});

describe("RBAC", () => {
  it("centralizes all enterprise roles", () => {
    const roles = listEnterpriseRoles();
    expect(roles).toContain("system_owner");
    expect(roles).toContain("organization_admin");
    expect(roles).toContain("program_director");
    expect(roles).toContain("supervisor");
    expect(roles).toContain("research_coordinator");
    expect(roles).toContain("guest");
    expect(roles.length).toBeGreaterThanOrEqual(12);
  });

  it("maps legacy membership roles", () => {
    expect(mapLegacyMembershipRole("institution_admin")).toBe(
      "organization_admin",
    );
    expect(mapLegacyMembershipRole("instructor")).toBe("faculty");
    expect(platformRoleToEnterprise("admin")).toBe("global_admin");
  });

  it("enforces permission matrix", () => {
    expect(hasPermission("student", "courses.manage")).toBe(false);
    expect(hasPermission("faculty", "assignments.grade")).toBe(true);
    expect(hasPermission("observer", "sessions.observe")).toBe(true);
    expect(assertPermission("guest", "security.manage").ok).toBe(false);
    expect(permissionsFor("organization_admin").length).toBeGreaterThan(10);
    expect(rbacMatrix().length).toBe(listEnterpriseRoles().length);
  });
});

describe("organization hierarchy", () => {
  it("builds hierarchy from institution rows", () => {
    const org = organizationFromInstitutionRow({
      id: ORG_A,
      slug: "state-med",
      name: "State Med",
      settings: { archetype: "university" },
    });
    expect(org.tenant_type).toBe("university");
    const h = buildOrgHierarchy({
      organization: org,
      campuses: [
        {
          id: "c1",
          organization_id: ORG_A,
          slug: "main",
          name: "Main",
          city: "Chicago",
          country_code: "US",
          is_active: true,
        },
      ],
      departments: [],
      programs: [],
    });
    expect(hierarchySummary(h).campus_count).toBe(1);
    expect(HIERARCHY_LABELS).toContain("Campus");
    expect(HIERARCHY_LABELS).toContain("Researcher");
  });
});

describe("course engine", () => {
  it("creates publishable course trees without cross-tenant attach", () => {
    let course = createCourse({
      organization_id: ORG_A,
      slug: "psych-clerkship",
      title: "Psychiatry Clerkship",
      competency_ids: ["alliance", "risk"],
    });
    course = publishCourse(course);
    expect(course.status).toBe("published");
    expect(course.version).toBe(2);

    const mod = createModule({
      course_id: course.id,
      organization_id: ORG_A,
      slug: "week-1",
      title: "Week 1",
    });
    const lesson = createLesson({
      module_id: mod.id,
      organization_id: ORG_A,
      slug: "sim-1",
      title: "First simulation",
      lesson_type: "simulation",
      simulation_template_slug: "mdd-moderate",
    });
    const attached = attachLesson(mod, lesson);
    expect(attached.lesson_ids).toContain(lesson.id);

    expect(() =>
      attachLesson(mod, {
        ...lesson,
        organization_id: ORG_B,
      }),
    ).toThrow(/Cross-tenant/);

    const rot = createRotation({
      organization_id: ORG_A,
      title: "Inpatient rotation",
    });
    expect(rot.organization_id).toBe(ORG_A);

    const path = createLearningPath({
      organization_id: ORG_A,
      slug: "residency-core",
      title: "Residency core",
      course_ids: [course.id],
    });
    expect(path.course_ids).toHaveLength(1);

    const grad = createGraduationRequirement({
      organization_id: ORG_A,
      label: "Clerkship complete",
      min_sessions: 10,
      required_competency_ids: ["alliance"],
      required_certificate_kinds: ["course"],
    });
    const evalPass = evaluateGraduation({
      requirement: grad,
      session_count: 12,
      overall_ema: 80,
      earned_competency_ids: ["alliance"],
      earned_certificate_kinds: ["course"],
    });
    expect(evalPass.met).toBe(true);
  });
});

describe("certification", () => {
  it("issues, verifies, revokes, and evaluates OSCE/board prep", () => {
    const cert = issueCertificate({
      organization_id: ORG_A,
      user_id: "user-1",
      kind: "osce",
      title: "OSCE Station Pass",
    });
    storeCertificate(cert);
    expect(CERTIFICATE_KINDS).toContain("university");
    const ok = verifyCertificate(cert.verification_code, listAllCertificates());
    expect(ok.valid).toBe(true);
    const revoked = revokeCertificate(cert);
    const bad = verifyCertificate(revoked.verification_code, [revoked]);
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe("revoked");

    expect(evaluateOscePass({ overall: 80, station_scores: [70, 75, 80] }).passed)
      .toBe(true);
    expect(
      boardPrepProgress({
        sessions_completed: 40,
        target_sessions: 40,
        overall_ema: 80,
        domain_floors_met: true,
      }).ready,
    ).toBe(true);
  });
});

describe("case libraries", () => {
  it("enforces approval workflow and visibility", () => {
    let lib = createLibrary({
      organization_id: ORG_A,
      slug: "dsm-core",
      title: "DSM core",
      kind: "dsm",
      visibility: "shared",
    });
    const added = addLibraryEntry(lib, {
      scenario_template_slug: "mdd-moderate",
      title: "MDD moderate",
    });
    lib = added.library;
    const entry = publishEntry(added.entry);
    expect(entry.published).toBe(true);
    lib = submitForApproval(lib);
    lib = approveLibrary(lib);
    expect(lib.approval_status).toBe("approved");
    expect(canReadLibrary(lib, ORG_B, false)).toBe(true);
    expect(
      canReadLibrary(
        { ...lib, visibility: "private", approval_status: "draft" },
        ORG_B,
        false,
      ),
    ).toBe(false);
  });
});

describe("analytics + longitudinal", () => {
  it("builds all dashboard scopes", () => {
    for (const scope of ANALYTICS_SCOPES) {
      const d = buildAnalyticsDashboard({
        organization_id: ORG_A,
        scope,
        session_count: 10,
        active_learners: 5,
        mean_overall: 72,
        completion_rate: 0.8,
      });
      expect(d.scope).toBe(scope);
      expect(d.kpis.length).toBeGreaterThan(0);
    }
    const track = buildLongitudinalTrack({
      user_id: "u1",
      organization_id: ORG_A,
      horizon: "residency",
      session_count: 30,
      overall_ema: 74,
    });
    expect(track.milestones.length).toBeGreaterThan(0);
  });
});

describe("research", () => {
  it("requires IRB and scopes participating orgs", () => {
    let study = createResearchStudy({
      slug: "multi-center-alliance",
      title: "Alliance study",
      lead_organization_id: ORG_A,
    });
    expect(() => activateStudy(study)).toThrow(/IRB/);
    study = { ...study, irb_tag: "IRB-2026-001" };
    study = activateStudy(study);
    study = addParticipatingOrg(study, ORG_B);
    expect(canOrgAccessStudy(study, ORG_B)).toBe(true);
    const manifest = buildExportManifest(study);
    expect(manifest.redaction).toMatch(/strip_pii/);
  });
});

describe("security + observability + APIs", () => {
  it("SSO/MFA policy and authorization audits", () => {
    let policy = defaultAuthPolicy(ORG_A);
    policy = enableSso(policy, "saml");
    expect(policy.mfa_required).toBe(true);
    expect(
      sessionStillValid({
        issued_at: new Date().toISOString(),
        policy,
      }),
    ).toBe(true);

    const denied = authorizeTenantAction({
      actorRole: "student",
      actorOrganizationId: ORG_A,
      resourceOrganizationId: ORG_B,
      permission: "reports.read_tenant",
      actorUserId: "u1",
    });
    expect(denied.allowed).toBe(false);
    expect(denied.audit.outcome).toBe("denied");

    const dash = buildSecurityDashboard({
      organization_id: ORG_A,
      policy,
      audits: [denied.audit],
      isolation_ok: true,
    });
    expect(dash.sso_enabled).toBe(true);
    expect(secretRef("webhook", ORG_A)).toMatch(/^vault:org\//);
  });

  it("observability and integration catalog", () => {
    const snap = buildObservabilitySnapshot({
      latencies_ms: Array.from({ length: 100 }, (_, i) => 50 + i),
      requests: 100,
      failures: 1,
      active_sessions: 200,
      queue_depth: 2,
      cost_events_usd: [0.01, 0.02],
    });
    expect(snap.health).toBe("ok");
    expect(PERFORMANCE_ENVELOPE.concurrent_sessions).toBe(1000);
    expect(integrationCatalog().length).toBe(8);
    expect(ENTERPRISE_REST_ROUTES.length).toBeGreaterThan(3);
    const wh = createWebhookEndpoint({
      organization_id: ORG_A,
      url: "https://example.edu/hooks/vpsych",
    });
    const sig = signWebhookPayload(wh.secret_ref, '{"ok":true}');
    expect(sig).toMatch(/^sha256=/);
  });
});

describe("enterprise engine", () => {
  it("runs bundle and admin overview", () => {
    const bundle = runEnterpriseEngine({
      organization_id: ORG_A,
      user_id: "u1",
      profile_role: "therapist",
      membership_role: "resident",
      overall: 88,
      issue_course_certificate: true,
    });
    expect(bundle.context.membership_role).toBe("resident");
    expect(bundle.certificates_issued.length).toBe(1);
    expect(bundle.ownership).toMatch(/Never owns Patient/);
    const overview = buildEnterpriseAdminOverview({
      organization_id: ORG_A,
      bundles: [bundle],
    });
    expect(overview.n_bundles).toBe(1);
  });
});

describe("performance envelope", () => {
  it("isolates 100 organizations quickly", () => {
    const orgs = Array.from({ length: PERFORMANCE_ENVELOPE.organizations }, (_, i) =>
      `org-${String(i).padStart(3, "0")}`,
    );
    const rows = orgs.flatMap((id) =>
      Array.from({ length: 20 }, (_, j) => ({
        organization_id: id,
        id: `${id}-${j}`,
      })),
    );
    const t0 = Date.now();
    for (const id of orgs) {
      const isolated = isolateByOrganization(rows, id);
      expect(isolated).toHaveLength(20);
    }
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("RBAC checks for 10k users stay under budget", () => {
    const roles = listEnterpriseRoles();
    const t0 = Date.now();
    for (let i = 0; i < PERFORMANCE_ENVELOPE.users; i++) {
      const role = roles[i % roles.length]!;
      void hasPermission(role, "courses.read");
    }
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("engine throughput smoke for concurrent session design", () => {
    const t0 = Date.now();
    for (let i = 0; i < 200; i++) {
      runEnterpriseEngine({
        organization_id: ORG_A,
        user_id: `u${i}`,
        profile_role: "therapist",
        overall: 60 + (i % 40),
      });
    }
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe("disaster recovery drill (logical)", () => {
  it("rebuilds cert verification after registry restore", () => {
    const cert = issueCertificate({
      organization_id: ORG_A,
      user_id: "u-dr",
      kind: "digital",
      title: "DR drill",
    });
    // Simulate loss + restore from exported registry
    const restored = [cert];
    expect(verifyCertificate(cert.verification_code, restored).valid).toBe(true);
  });
});
