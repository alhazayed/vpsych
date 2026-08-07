/**
 * Course Engine — Stage 10.
 * Courses · Modules · Lessons · Rotations · Assignments · Learning Paths · Graduation.
 * Composes Education (Stage 7) competency ids — does not fork ACE/CGE.
 */

import { ENTERPRISE_COURSE_ENGINE_VERSION } from "@/lib/enterprise/types";
import type {
  ClinicalRotation,
  Course,
  CourseLesson,
  CourseModule,
  GraduationRequirement,
  LearningPath,
} from "@/lib/enterprise/types";

export { ENTERPRISE_COURSE_ENGINE_VERSION };

export function createCourse(input: {
  id?: string;
  organization_id: string;
  program_id?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  language?: string;
  competency_ids?: string[];
  graduation_requirement_ids?: string[];
  created_by?: string | null;
}): Course {
  return {
    id: input.id ?? `course_${input.organization_id}_${input.slug}`,
    organization_id: input.organization_id,
    program_id: input.program_id ?? null,
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    status: "draft",
    language: input.language ?? "en",
    competency_ids: input.competency_ids ?? [],
    graduation_requirement_ids: input.graduation_requirement_ids ?? [],
    version: 1,
    created_by: input.created_by ?? null,
  };
}

export function publishCourse(course: Course): Course {
  if (course.status === "retired") {
    throw new Error("Cannot publish a retired course");
  }
  return { ...course, status: "published", version: course.version + 1 };
}

export function createModule(input: {
  id?: string;
  course_id: string;
  organization_id: string;
  slug: string;
  title: string;
  sort_order?: number;
}): CourseModule {
  return {
    id: input.id ?? `mod_${input.course_id}_${input.slug}`,
    course_id: input.course_id,
    organization_id: input.organization_id,
    slug: input.slug,
    title: input.title,
    sort_order: input.sort_order ?? 0,
    lesson_ids: [],
  };
}

export function createLesson(input: {
  id?: string;
  module_id: string;
  organization_id: string;
  slug: string;
  title: string;
  sort_order?: number;
  lesson_type?: CourseLesson["lesson_type"];
  simulation_template_slug?: string | null;
  estimated_minutes?: number | null;
}): CourseLesson {
  return {
    id: input.id ?? `les_${input.module_id}_${input.slug}`,
    module_id: input.module_id,
    organization_id: input.organization_id,
    slug: input.slug,
    title: input.title,
    sort_order: input.sort_order ?? 0,
    lesson_type: input.lesson_type ?? "didactic",
    simulation_template_slug: input.simulation_template_slug ?? null,
    estimated_minutes: input.estimated_minutes ?? null,
  };
}

export function attachLesson(
  module: CourseModule,
  lesson: CourseLesson,
): CourseModule {
  if (module.organization_id !== lesson.organization_id) {
    throw new Error("Cross-tenant lesson attach denied");
  }
  if (lesson.module_id !== module.id) {
    throw new Error("Lesson module_id mismatch");
  }
  if (module.lesson_ids.includes(lesson.id)) return module;
  return { ...module, lesson_ids: [...module.lesson_ids, lesson.id] };
}

export function createRotation(input: {
  id?: string;
  organization_id: string;
  program_id?: string | null;
  course_id?: string | null;
  title: string;
  site_label?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  supervisor_user_ids?: string[];
  competency_ids?: string[];
}): ClinicalRotation {
  return {
    id: input.id ?? `rot_${input.organization_id}_${slugify(input.title)}`,
    organization_id: input.organization_id,
    program_id: input.program_id ?? null,
    course_id: input.course_id ?? null,
    title: input.title,
    site_label: input.site_label ?? null,
    starts_on: input.starts_on ?? null,
    ends_on: input.ends_on ?? null,
    supervisor_user_ids: input.supervisor_user_ids ?? [],
    competency_ids: input.competency_ids ?? [],
  };
}

export function createLearningPath(input: {
  id?: string;
  organization_id: string;
  slug: string;
  title: string;
  course_ids?: string[];
  required_certificate_kinds?: LearningPath["required_certificate_kinds"];
}): LearningPath {
  return {
    id: input.id ?? `path_${input.organization_id}_${input.slug}`,
    organization_id: input.organization_id,
    slug: input.slug,
    title: input.title,
    course_ids: input.course_ids ?? [],
    required_certificate_kinds: input.required_certificate_kinds ?? [],
  };
}

export function createGraduationRequirement(input: {
  id?: string;
  organization_id: string;
  program_id?: string | null;
  label: string;
  min_sessions?: number;
  min_overall_score?: number;
  required_competency_ids?: string[];
  required_certificate_kinds?: GraduationRequirement["required_certificate_kinds"];
}): GraduationRequirement {
  return {
    id: input.id ?? `grad_${input.organization_id}_${slugify(input.label)}`,
    organization_id: input.organization_id,
    program_id: input.program_id ?? null,
    label: input.label,
    min_sessions: input.min_sessions ?? 10,
    min_overall_score: input.min_overall_score ?? 70,
    required_competency_ids: input.required_competency_ids ?? [],
    required_certificate_kinds: input.required_certificate_kinds ?? [],
  };
}

export function evaluateGraduation(opts: {
  requirement: GraduationRequirement;
  session_count: number;
  overall_ema: number;
  earned_competency_ids: string[];
  earned_certificate_kinds: GraduationRequirement["required_certificate_kinds"];
}): { met: boolean; gaps: string[] } {
  const gaps: string[] = [];
  if (opts.session_count < opts.requirement.min_sessions) {
    gaps.push(
      `sessions:${opts.session_count}<${opts.requirement.min_sessions}`,
    );
  }
  if (opts.overall_ema < opts.requirement.min_overall_score) {
    gaps.push(
      `score:${opts.overall_ema}<${opts.requirement.min_overall_score}`,
    );
  }
  for (const id of opts.requirement.required_competency_ids) {
    if (!opts.earned_competency_ids.includes(id)) gaps.push(`competency:${id}`);
  }
  for (const kind of opts.requirement.required_certificate_kinds) {
    if (!opts.earned_certificate_kinds.includes(kind)) {
      gaps.push(`certificate:${kind}`);
    }
  }
  return { met: gaps.length === 0, gaps };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
