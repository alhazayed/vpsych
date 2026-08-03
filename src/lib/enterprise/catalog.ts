/**
 * Builtin demo institution tree for offline tests / certification.
 */

import type { InstitutionTree } from "@/lib/enterprise/types";

export const DEMO_INSTITUTION_ID = "a1000000-0000-4000-8000-000000000001";

export function getBuiltinInstitutionTree(): InstitutionTree {
  return {
    institution: {
      id: DEMO_INSTITUTION_ID,
      slug: "vpsych-demo-university",
      name: "VPsych Demo University",
      legal_name: "VPsych Demo University LLC",
      country_code: "US",
      timezone: "America/New_York",
      locale_default: "en-US",
      sso_enabled: false,
      sso_provider: null,
      sso_metadata: {},
      settings: {},
      is_active: true,
    },
    departments: [
      {
        id: "a1000000-0000-4000-8000-000000000010",
        institution_id: DEMO_INSTITUTION_ID,
        slug: "psychiatry",
        name: "Department of Psychiatry",
        is_active: true,
      },
    ],
    programs: [
      {
        id: "a1000000-0000-4000-8000-000000000020",
        institution_id: DEMO_INSTITUTION_ID,
        department_id: "a1000000-0000-4000-8000-000000000010",
        slug: "psychiatry-residency",
        name: "Psychiatry Residency",
        degree_type: "residency",
        is_active: true,
      },
    ],
    academic_years: [
      {
        id: "a1000000-0000-4000-8000-000000000030",
        institution_id: DEMO_INSTITUTION_ID,
        label: "2025-2026",
        starts_on: "2025-07-01",
        ends_on: "2026-06-30",
        is_current: true,
      },
    ],
    terms: [
      {
        id: "a1000000-0000-4000-8000-000000000040",
        institution_id: DEMO_INSTITUTION_ID,
        academic_year_id: "a1000000-0000-4000-8000-000000000030",
        slug: "fall-2025",
        name: "Fall 2025",
        starts_on: "2025-08-15",
        ends_on: "2025-12-20",
        is_current: true,
      },
    ],
    cohorts: [
      {
        id: "a1000000-0000-4000-8000-000000000050",
        institution_id: DEMO_INSTITUTION_ID,
        program_id: "a1000000-0000-4000-8000-000000000020",
        academic_year_id: "a1000000-0000-4000-8000-000000000030",
        slug: "pg1-2025",
        name: "PGY-1 Class of 2025",
        intake_label: "2025",
        is_active: true,
      },
    ],
    classes: [
      {
        id: "a1000000-0000-4000-8000-000000000060",
        institution_id: DEMO_INSTITUTION_ID,
        cohort_id: "a1000000-0000-4000-8000-000000000050",
        term_id: "a1000000-0000-4000-8000-000000000040",
        program_id: "a1000000-0000-4000-8000-000000000020",
        slug: "osce-station-a",
        name: "OSCE Station Group A",
        group_label: "Group A",
        capacity: 24,
        is_active: true,
      },
    ],
    memberships: [],
    assignments: [
      {
        id: "a1000000-0000-4000-8000-000000000070",
        institution_id: DEMO_INSTITUTION_ID,
        class_id: "a1000000-0000-4000-8000-000000000060",
        cohort_id: "a1000000-0000-4000-8000-000000000050",
        title: "Required: Suicide Risk OSCE",
        description: "Complete PTSD risk assessment station",
        status: "published",
        is_required: true,
        is_elective: false,
        due_at: "2025-12-01T23:59:59.000Z",
        opens_at: "2025-08-15T00:00:00.000Z",
        scenario_template_slug: "ptsd-risk-assessment-en",
        instructor_preset_slug: "suicide-risk-resident-en",
        required_competency_ids: ["safety", "alliance"],
        pass_threshold: 70,
        max_attempts: 3,
      },
      {
        id: "a1000000-0000-4000-8000-000000000071",
        institution_id: DEMO_INSTITUTION_ID,
        class_id: "a1000000-0000-4000-8000-000000000060",
        title: "Elective: Arabic GAD OSCE",
        description: "Optional Levantine OSCE practice",
        status: "published",
        is_required: false,
        is_elective: true,
        due_at: null,
        scenario_template_slug: "adult-gad-osce-ar",
        instructor_preset_slug: "osce-diagnostic-interview-ar",
        required_competency_ids: ["communication"],
        pass_threshold: 65,
        max_attempts: 5,
      },
    ],
  };
}
