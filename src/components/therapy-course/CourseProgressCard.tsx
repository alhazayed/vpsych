import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { courseProgress, loadCourseById } from "@/lib/therapy-course";

/**
 * Post-session course card: which visit this was, and the next step
 * (write the treatment plan, continue, or therapy completed).
 * Renders nothing for standalone sessions.
 */
export async function CourseProgressCard({
  supabase,
  courseId,
  sessionNumber,
}: {
  supabase: SupabaseClient;
  courseId: string | null | undefined;
  sessionNumber: number | null | undefined;
}) {
  if (!courseId) return null;
  const course = await loadCourseById(supabase, courseId);
  if (!course) return null;
  const t = await getTranslations("course");

  const { data: rows } = await supabase
    .from("sessions")
    .select("status")
    .eq("therapy_course_id", course.id);
  const progress = courseProgress(course, (rows ?? []) as { status: string }[]);
  const active = course.status === "active";

  return (
    <section className="clinical-card mb-4 p-5 fade-in-up">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("progressTitle")}
        </h2>
        <span
          className={`status-chip ${active ? "status-chip-active" : "status-chip-done"}`}
        >
          {active ? t("statusActive") : t("statusCompleted")}
        </span>
      </div>
      {sessionNumber ? (
        <p className="text-sm text-[var(--on-surface-variant)]">
          {t("sessionOf", { n: sessionNumber, total: course.planned_sessions })}
        </p>
      ) : null}
      {active && progress.planRequired ? (
        <>
          <p className="mt-3 text-sm text-[var(--on-surface)]">
            {t("planRequiredTitle")}
          </p>
          <Link
            href={`/courses/${course.id}#plan`}
            className="btn-primary mt-3 h-11 w-full"
          >
            <span className="material-symbols-outlined text-[20px]">assignment</span>
            {t("planRequiredCta")}
          </Link>
        </>
      ) : (
        <Link
          href={`/courses/${course.id}`}
          className="btn-secondary mt-3 h-11 w-full"
        >
          <span className="material-symbols-outlined text-[20px]">timeline</span>
          {t("openCourse")}
        </Link>
      )}
    </section>
  );
}
