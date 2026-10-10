import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import {
  buildCaseFormulationKey,
  courseProgress,
  isPlanNew,
  loadCourseById,
} from "@/lib/therapy-course";
import { FIVE_PS, type TherapySession } from "@/lib/types";
import { StartSessionButton } from "@/components/StartSessionButton";
import { TreatmentPlanForm } from "@/components/therapy-course/TreatmentPlanForm";
import { EndCourseButton } from "@/components/therapy-course/EndCourseButton";
import { SkillProgressChart } from "@/components/progress/SkillProgressChart";
import { FormulationReviewPanel } from "@/components/admin/FormulationReviewPanel";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import { buildSkillProgress, type SkillProgress } from "@/lib/skill-progress";

type Props = { params: Promise<{ id: string }> };

type CourseSessionRow = Pick<
  TherapySession,
  "id" | "status" | "started_at" | "interaction_mode" | "course_session_number"
>;

export default async function TherapyCoursePage({ params }: Props) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();
  const t = await getTranslations("course");
  const tP = await getTranslations("course.fivePs");
  const format = await getFormatter();

  const course = await loadCourseById(supabase, id);
  if (!course) notFound();
  if (course.therapist_id !== user.id && profile.role !== "admin") {
    redirect("/avatars");
  }
  const isOwner = course.therapist_id === user.id;

  const [{ data: avatar }, { data: sessionRows }] = await Promise.all([
    supabase
      .from("avatars")
      .select("id, name")
      .eq("id", course.avatar_id)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id, status, started_at, interaction_mode, course_session_number")
      .eq("therapy_course_id", course.id)
      .order("started_at", { ascending: true }),
  ]);
  const sessions = (sessionRows ?? []) as CourseSessionRow[];
  const name = (avatar?.name as string | undefined) ?? "";
  const progress = courseProgress(course, sessions);
  const plan = course.treatment_plan;
  const therapyRoom = isTherapyRoomEnabled();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  function sessionHref(s: CourseSessionRow) {
    const room = therapyRoom && s.interaction_mode === "therapy_room";
    if (s.status === "active") {
      return room ? `/clinic/room/${s.id}` : `/sessions/${s.id}`;
    }
    return room ? `/clinic/room/${s.id}/debrief` : `/sessions/${s.id}/complete`;
  }

  const active = course.status === "active";

  // Skill progress reads report scores, which stay admin-only.
  let skillProgress: SkillProgress | null = null;
  if (profile.role === "admin" && sessions.length > 0) {
    const [{ data: reportRows }, tProgress, locale] = await Promise.all([
      supabase
        .from("session_reports")
        .select("session_id, scores")
        .in(
          "session_id",
          sessions.map((s) => s.id),
        ),
      getTranslations("progress"),
      getLocale(),
    ]);
    const bySession = new Map(
      (reportRows ?? []).map((r) => [r.session_id as string, r]),
    );
    skillProgress = buildSkillProgress(
      sessions.map((s) => ({
        id: s.id,
        started_at: s.started_at,
        course_session_number: s.course_session_number,
        session_reports: bySession.get(s.id) ?? null,
      })),
      {
        language: normalizeReportLanguage(locale),
        overallLabel: tProgress("overall"),
      },
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <Link
        href="/avatars"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
      >
        <span aria-hidden className="material-symbols-outlined text-[18px] rtl:rotate-180">
          arrow_back
        </span>
        {t("backToPatients")}
      </Link>

      <section className="mb-6 fade-in-up">
        <span
          className={`status-chip ${active ? "status-chip-active" : "status-chip-done"}`}
        >
          {active ? t("statusActive") : t("statusCompleted")}
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("courseTitle", { name })}
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {t("sessionsHeld", { count: progress.sessionCount })}
          {active && !progress.lengthReached
            ? ` · ${t("nextSession", {
                n: progress.nextSessionNumber,
                total: course.planned_sessions,
              })}`
            : ""}
        </p>
        {!active && course.completed_at && (
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {course.completion_reason === "course_length"
              ? t("completedReasonLength", {
                  total: course.planned_sessions,
                  date: date(course.completed_at),
                })
              : t("completedReasonTerminated", { date: date(course.completed_at) })}
          </p>
        )}
        {active && (
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            {t("intro")}
          </p>
        )}
      </section>

      {active && isOwner && progress.planRequired && (
        <section
          className="clinical-card mb-4 border-s-4 border-[var(--primary)] p-5 fade-in-up"
          id="plan"
        >
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("planRequiredTitle")}
          </h2>
          <p className="mt-1 mb-4 text-sm text-[var(--on-surface-variant)]">
            {t("planRequiredBody", { name })}
          </p>
          {progress.canWritePlan ? (
            <TreatmentPlanForm
              courseId={course.id}
              initialPlan={null}
              minSessions={progress.minPlannedSessions}
            />
          ) : null}
        </section>
      )}

      {plan && (
        <section className="clinical-card mb-4 p-5 fade-in-up" id="plan">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("planTitle")}
          </h2>
          {course.plan_updated_at && (
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              {t("planSubmitted", { date: date(course.plan_updated_at) })}
            </p>
          )}
          <div className="mt-4 space-y-4 text-sm" dir="auto">
            <p className="whitespace-pre-wrap text-[var(--on-surface)]">
              {plan.formulation}
            </p>
            {plan.five_ps ? (
              <div>
                <h3 className="mb-1 font-semibold">{tP("title")}</h3>
                <dl className="space-y-2">
                  {FIVE_PS.map((p) => (
                    <div key={p}>
                      <dt className="font-medium text-[var(--on-surface-variant)]">
                        {tP(p)}
                      </dt>
                      <dd className="whitespace-pre-wrap">{plan.five_ps?.[p]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <div>
              <h3 className="mb-1 font-semibold">{t("goals")}</h3>
              <ol className="list-decimal space-y-1 ps-5">
                {plan.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">{t("interventions")}</h3>
              <p className="whitespace-pre-wrap">{plan.interventions}</p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">{t("expectations")}</h3>
              <p className="whitespace-pre-wrap">{plan.patient_expectations}</p>
            </div>
            {plan.risk_formulation ? (
              <div>
                <h3 className="mb-1 font-semibold">{t("risk")}</h3>
                <p className="whitespace-pre-wrap">{plan.risk_formulation}</p>
              </div>
            ) : null}
            <p className="text-[var(--on-surface-variant)]">
              {t("expectedSessions", { n: plan.expected_sessions })}
            </p>
          </div>
          {active && isOwner && progress.canWritePlan && (
            <details className="mt-4 border-t border-[var(--outline-variant)] pt-4">
              <summary className="cursor-pointer text-sm font-medium text-[var(--primary)]">
                {t("planRevise")}
              </summary>
              <div className="mt-4">
                <TreatmentPlanForm
                  courseId={course.id}
                  initialPlan={plan}
                  minSessions={progress.minPlannedSessions}
                />
              </div>
            </details>
          )}
        </section>
      )}

      {active && isOwner && !plan && !progress.planRequired && (
        <p className="mb-4 text-sm text-[var(--on-surface-variant)]">
          {t("planUpcoming")}
        </p>
      )}

      {active && isOwner && (
        <section className="clinical-card mb-4 space-y-3 p-5 fade-in-up">
          {progress.lengthReached && (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("lengthReached")}
            </p>
          )}
          {progress.canStartNext && (
            <>
              <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                {t("startNext", { n: progress.nextSessionNumber })}
              </h2>
              {isPlanNew(course, sessions.at(-1)?.started_at ?? null) && (
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {t("planPresentNote")}
                </p>
              )}
              {progress.nextIsFinal && (
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {t("finalSessionNote", { n: progress.nextSessionNumber })}
                </p>
              )}
              <StartSessionButton avatarId={course.avatar_id} />
            </>
          )}
          <EndCourseButton courseId={course.id} patientName={name} />
        </section>
      )}

      {profile.role === "admin" && plan && (
        <FormulationReviewPanel
          courseId={course.id}
          fivePs={plan.five_ps}
          caseKey={buildCaseFormulationKey(course.clinical_snapshot)}
        />
      )}

      {skillProgress && (
        <div className="mb-4 fade-in-up">
          <SkillProgressChart
            progress={skillProgress}
            title={t("progressTitle")}
          />
        </div>
      )}

      <section className="clinical-card overflow-hidden fade-in-up">
        <div className="border-b border-[var(--outline-variant)] px-5 py-3">
          <h2 className="text-sm font-semibold">{t("sessionsTitle")}</h2>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {sessions.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <span>
                <span className="font-medium">
                  {t("sessionBadge", { n: s.course_session_number ?? i + 1 })}
                </span>
                <span className="text-[var(--on-surface-variant)]">
                  {" · "}
                  {date(s.started_at)}
                </span>
              </span>
              <Link
                href={sessionHref(s)}
                className="font-medium text-[var(--primary)] hover:underline"
              >
                {s.status === "active" ? t("resumeSession") : t("viewSession")}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
