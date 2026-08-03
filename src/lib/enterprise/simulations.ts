/**
 * Mission 23 — Institutional deployment simulations.
 * University / Teaching Hospital / Private / Government program archetypes.
 */

import { getBuiltinInstitutionTree } from "@/lib/enterprise/catalog";
import {
  canAct,
  FACULTY_ROLES,
  LEARNER_ROLES,
  type EnterprisePermission,
} from "@/lib/enterprise/roles";
import {
  assertSameTenant,
  canPermissionOnInstitution,
  filterByTenant,
  type TenantContext,
} from "@/lib/enterprise/tenant";
import type {
  EnterpriseMembershipRole,
  Institution,
  InstitutionMembership,
} from "@/lib/enterprise/types";
import { buildInstitutionAnalytics } from "@/lib/enterprise/analytics";
import {
  assertNoPiiKeys,
  buildAnonymousResearchExport,
} from "@/lib/enterprise/research-export";

export type InstitutionArchetype =
  | "university"
  | "teaching_hospital"
  | "private_institution"
  | "government_program";

export type SimulatedInstitution = {
  archetype: InstitutionArchetype;
  institution: Institution;
  memberships: InstitutionMembership[];
  sessions: Array<{ id: string; institution_id: string; therapist_id: string; score: number }>;
};

const ARCHETYPE_META: Record<
  InstitutionArchetype,
  { id: string; slug: string; name: string; country: string; locale: string }
> = {
  university: {
    id: "b1000000-0000-4000-8000-000000000001",
    slug: "state-medical-university",
    name: "State Medical University",
    country: "US",
    locale: "en-US",
  },
  teaching_hospital: {
    id: "b1000000-0000-4000-8000-000000000002",
    slug: "metro-teaching-hospital",
    name: "Metro Teaching Hospital",
    country: "US",
    locale: "en-US",
  },
  private_institution: {
    id: "b1000000-0000-4000-8000-000000000003",
    slug: "harbor-private-college",
    name: "Harbor Private College of Medicine",
    country: "US",
    locale: "en-US",
  },
  government_program: {
    id: "b1000000-0000-4000-8000-000000000004",
    slug: "national-moh-training",
    name: "National Ministry of Health Training Program",
    country: "JO",
    locale: "ar-JO",
  },
};

function mkMembership(
  institutionId: string,
  userId: string,
  role: EnterpriseMembershipRole,
): InstitutionMembership {
  return {
    id: `${institutionId}-${userId}-${role}`,
    institution_id: institutionId,
    user_id: userId,
    role,
    is_primary: true,
    is_active: true,
  };
}

export function simulateInstitution(
  archetype: InstitutionArchetype,
): SimulatedInstitution {
  const meta = ARCHETYPE_META[archetype];
  const institution: Institution = {
    id: meta.id,
    slug: meta.slug,
    name: meta.name,
    country_code: meta.country,
    timezone: "UTC",
    locale_default: meta.locale,
    sso_enabled: archetype !== "private_institution",
    settings: { archetype },
    is_active: true,
  };

  const roles: EnterpriseMembershipRole[] =
    archetype === "teaching_hospital"
      ? ["resident", "faculty", "program_director", "institution_admin"]
      : archetype === "university"
        ? ["student", "faculty", "instructor", "program_director", "institution_admin"]
        : archetype === "government_program"
          ? ["gp", "instructor", "institution_admin"]
          : ["student", "instructor", "institution_admin"];

  const memberships = roles.map((role, i) =>
    mkMembership(meta.id, `user-${archetype}-${i}`, role),
  );

  const learnerIds = memberships
    .filter((m) => (LEARNER_ROLES as string[]).includes(m.role))
    .map((m) => m.user_id);

  const sessions = learnerIds.flatMap((uid, i) => [
    {
      id: `sess-${archetype}-${i}-a`,
      institution_id: meta.id,
      therapist_id: uid,
      score: 62 + i * 5,
    },
    {
      id: `sess-${archetype}-${i}-b`,
      institution_id: meta.id,
      therapist_id: uid,
      score: 78 + i * 3,
    },
  ]);

  return { archetype, institution, memberships, sessions };
}

export type SimulationResult = {
  archetype: InstitutionArchetype;
  ok: boolean;
  checks: Record<string, boolean>;
  notes: string[];
};

export function runInstitutionSimulation(
  archetype: InstitutionArchetype,
): SimulationResult {
  const sim = simulateInstitution(archetype);
  const notes: string[] = [];
  const checks: Record<string, boolean> = {};

  const facultyCtx: TenantContext = {
    platformRole: "therapist",
    memberships: sim.memberships.filter((m) =>
      (FACULTY_ROLES as string[]).includes(m.role),
    ),
  };
  const learnerCtx: TenantContext = {
    platformRole: "therapist",
    memberships: sim.memberships.filter((m) =>
      (LEARNER_ROLES as string[]).includes(m.role),
    ),
  };
  const foreign = simulateInstitution(
    archetype === "university" ? "government_program" : "university",
  );

  checks.has_faculty = facultyCtx.memberships.length > 0;
  checks.has_learners = learnerCtx.memberships.length > 0;

  checks.faculty_can_analytics = canPermissionOnInstitution(
    facultyCtx,
    sim.institution.id,
    "analytics.class",
  );
  checks.learner_denied_research = !canPermissionOnInstitution(
    learnerCtx,
    sim.institution.id,
    "research.export",
  );

  const pd = facultyCtx.memberships.find(
    (m) => m.role === "program_director" || m.role === "institution_admin",
  );
  checks.pd_or_admin_research = pd
    ? canAct("therapist", [pd.role], "research.export" as EnterprisePermission)
    : facultyCtx.memberships.some((m) =>
        canAct("therapist", [m.role], "research.export"),
      );

  const mixed = [
    ...sim.sessions.map((s) => ({ institution_id: s.institution_id })),
    ...foreign.sessions.map((s) => ({ institution_id: s.institution_id })),
  ];
  const filtered = filterByTenant(facultyCtx, mixed);
  checks.tenant_filter_excludes_foreign = filtered.every(
    (r) => r.institution_id === sim.institution.id,
  );
  checks.cross_tenant_assert = !assertSameTenant(
    sim.institution.id,
    foreign.institution.id,
  ).ok;

  const analytics = buildInstitutionAnalytics({
    institution_id: sim.institution.id,
    learners: learnerCtx.memberships.map((m) => ({
      user_id: m.user_id,
      scores: sim.sessions
        .filter((s) => s.therapist_id === m.user_id)
        .map((s) => s.score),
      completed_required: 1,
      total_required: 2,
    })),
    assignments: [
      {
        id: "a1",
        institution_id: sim.institution.id,
        title: "Required OSCE",
        status: "published",
        is_required: true,
        is_elective: false,
        required_competency_ids: ["safety"],
        pass_threshold: 70,
        max_attempts: 3,
      },
    ],
    completions: sim.sessions.map((s, i) => ({
      id: `c-${i}`,
      assignment_id: "a1",
      user_id: s.therapist_id,
      status: s.score >= 70 ? ("passed" as const) : ("failed" as const),
      attempt_number: 1,
      score: s.score,
    })),
  });
  checks.analytics_computed =
    analytics.learner_count >= 0 && analytics.assignment_count === 1;

  const exportPayload = buildAnonymousResearchExport(
    sim.sessions.map((s) => ({
      user_id: s.therapist_id,
      session_id: s.id,
      overall_score: s.score,
      locale: sim.institution.locale_default,
    })),
    {
      salt: `sim-${archetype}-salt`,
      version_lock: "mission23",
      include_timestamps: false,
    },
  );
  checks.research_no_pii = assertNoPiiKeys(exportPayload).length === 0;

  // Builtin tree still valid for offline demo university
  if (archetype === "university") {
    const tree = getBuiltinInstitutionTree();
    checks.builtin_tree = Boolean(tree.institution && tree.programs.length);
  } else {
    checks.builtin_tree = true;
  }

  const ok = Object.values(checks).every(Boolean);
  if (!ok) {
    notes.push(
      ...Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => `failed:${k}`),
    );
  } else {
    notes.push(`${archetype} institutional simulation passed`);
  }

  return { archetype, ok, checks, notes };
}

export function runAllInstitutionSimulations(): {
  results: SimulationResult[];
  allPassed: boolean;
} {
  const archetypes: InstitutionArchetype[] = [
    "university",
    "teaching_hospital",
    "private_institution",
    "government_program",
  ];
  const results = archetypes.map(runInstitutionSimulation);
  return { results, allPassed: results.every((r) => r.ok) };
}
