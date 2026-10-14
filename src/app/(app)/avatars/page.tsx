import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { localeNativeNames } from "@/lib/locale-names";
import {
  avatarDisplayName,
  avatarLocalNameSelect,
} from "@/lib/avatars/localized-name";
import { defaultDisorderText, sessionGoalText } from "@/lib/avatars/card-text";
import type { Avatar } from "@/lib/types";
import { StartSessionButton } from "@/components/StartSessionButton";
import { PracticeScenarioPicker } from "@/components/skill-tests/PracticeScenarioPicker";
import { isPatientCompatible, listDisorderOptions } from "@/lib/skill-tests";
import { ErrorState } from "@/components/admin/AdminUi";
import {
  COURSE_COLUMNS,
  courseProgress,
  isCourseSchemaMissing,
  normalizeCourseRow,
  type CourseProgress,
} from "@/lib/therapy-course";
import {
  ladderLevelDef,
  loadLadderAvatarIds,
  loadLadderOverview,
  withoutLadderAvatars,
} from "@/lib/training-ladder";
import { LadderLevelList } from "@/components/training/LadderLevelList";
import { PatientPortrait } from "@/components/training/PatientPortrait";

export default async function AvatarsPage() {
  const { supabase, profile } = await requireProfile();
  const t = await getTranslations("avatars");
  const tCommon = await getTranslations("common");
  const tPractice = await getTranslations("skillTests.practice");
  const tDisorders = await getTranslations("skillTests.disorders");
  const tDefaultDisorders = await getTranslations("avatars.defaultDisorders");
  const tGoals = await getTranslations("avatars.sessionGoals");
  const tTraining = await getTranslations("training");
  const locale = await getLocale();
  const genderLabel = (g: string) => {
    const key = `genders.${g.trim().toLowerCase()}`;
    return t.has(key) ? t(key) : g;
  };
  const { data: avatars, error: avatarsError } = await supabase
    .from("avatars")
    .select(
      `id, name, disorder, age, gender, portrait_url, ideal_guidelines, is_active, available_locales, ${avatarLocalNameSelect(locale)}`,
    )
    .eq("is_active", true)
    .order("name");
  if (avatarsError) {
    console.warn("[avatars] list:", avatarsError.message);
  }

  // Open therapy courses, keyed by patient. Empty when the table is missing.
  const { data: courseRows, error: courseError } = await supabase
    .from("therapy_courses")
    .select(COURSE_COLUMNS)
    .eq("therapist_id", profile.id)
    .eq("status", "active");
  if (courseError && !isCourseSchemaMissing(courseError)) {
    console.error("[avatars] courses load failed", { error: courseError.message });
  }
  const courses = (courseRows ?? []).map((r) =>
    normalizeCourseRow(r as Record<string, unknown>),
  );
  const { data: courseSessionRows, error: courseSessionsError } = courses.length
    ? await supabase
        .from("sessions")
        .select("status, therapy_course_id")
        .in(
          "therapy_course_id",
          courses.map((c) => c.id),
        )
    : { data: [], error: null };
  if (courseSessionsError) {
    console.error("[avatars] course sessions load failed", {
      error: courseSessionsError.message,
    });
  }
  const courseByAvatar = new Map<
    string,
    { id: string; planned: number; progress: CourseProgress }
  >();
  for (const c of courses) {
    const rows = ((courseSessionRows ?? []) as Array<{
      status: string;
      therapy_course_id: string;
    }>).filter((r) => r.therapy_course_id === c.id);
    courseByAvatar.set(c.avatar_id, {
      id: c.id,
      planned: c.planned_sessions,
      progress: courseProgress(c, rows),
    });
  }
  const tCourse = await getTranslations("course");

  // The Training Program comes first; its patients are played only through
  // their levels, so they are left out of free practice below.
  const program = await loadLadderOverview(supabase, profile.id, locale);
  const ladderAvatarIds = await loadLadderAvatarIds(supabase);
  const list = withoutLadderAvatars(
    (avatars as
      | (Omit<
          Avatar,
          "persona_prompt" | "rubric" | "created_at" | "updated_at"
        > & { local_name?: string | null })[]
      | null) ?? [],
    ladderAvatarIds,
  ).map((a) => ({ ...a, name: avatarDisplayName(a) }));

  // Practice scenarios: every active disorder with the patients who can
  // present with it (age and gender limits from the Case Engine).
  const practiceDisorders = listDisorderOptions().map((d) => ({
    slug: d.slug,
    patientIds: list
      .filter((a) =>
        isPatientCompatible(d.slug, {
          age: typeof a.age === "number" ? a.age : null,
          gender: a.gender ?? null,
        }),
      )
      .map((a) => a.id),
  }));

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <p className="mb-1 text-sm font-medium uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
          {t("welcomeBack")}
        </p>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)] md:text-[32px] md:leading-10">
          {profile.display_name}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--on-surface-variant)]">
          {t("intro")}
        </p>
      </section>

      <section className="mb-12 fade-in-up" aria-labelledby="program-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="program-title"
              className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]"
            >
              {t("program.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--on-surface-variant)]">
              {t("program.intro")}
            </p>
          </div>
          <Link href="/training" className="btn-secondary">
            <span aria-hidden className="material-symbols-outlined text-[20px]">
              stairs
            </span>
            {t("program.progressLink")}
          </Link>
        </div>
        {!program.available ? (
          <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
            {tTraining("unavailable")}
          </p>
        ) : program.patients.length === 0 ? (
          <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
            {tTraining("empty")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {program.patients.map((p) => (
              <article key={p.patient.key} className="clinical-card space-y-3 p-5">
                <div className="flex items-center gap-4">
                  <PatientPortrait
                    name={p.avatar.display_name}
                    portraitUrl={p.avatar.portrait_url}
                  />
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                      {tTraining("patientTitle", {
                        n: String(p.patient.slot).padStart(2, "0"),
                        name: p.avatar.display_name,
                      })}
                    </h3>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {tTraining("primary", {
                        disorder: tDisorders.has(p.patient.primaryDisorderSlug)
                          ? tDisorders(p.patient.primaryDisorderSlug)
                          : p.patient.primaryDisorderSlug,
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold">
                  {p.progress.completed
                    ? tTraining("allCleared")
                    : tTraining("currentLevel", {
                        level: tTraining(
                          `levels.${ladderLevelDef(p.progress.currentLevel).key}`,
                        ),
                      })}
                </p>
                <LadderLevelList progress={p.progress} compact />
                <Link href={`/training/${p.patient.key}`} className="btn-primary w-full">
                  {tTraining("open")}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
            {t("freePracticeTitle")}
          </h2>
          {avatarsError ? null : (
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {t("count", {
                count: list.length,
                persona: list.length === 1 ? t("persona") : t("personas"),
              })}
            </p>
          )}
        </div>
      </div>

      {avatarsError ? (
        <ErrorState
          title={t("loadErrorTitle")}
          description={t("loadErrorDescription")}
        />
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((avatar, index) => (
          <article
            key={avatar.id}
            className="clinical-card clinical-card-interactive fade-in-up overflow-hidden"
            style={{ animationDelay: `${0.05 * (index + 1)}s` }}
          >
            <div className="relative h-48 bg-[var(--surface-container)]">
              {avatar.portrait_url ? (
                <Image
                  src={avatar.portrait_url}
                  alt={avatar.name}
                  fill
                  className="object-cover object-top"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-[family-name:var(--font-headline)] text-4xl font-bold text-[var(--primary)]">
                  {avatar.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                    {avatar.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {defaultDisorderText(avatar.disorder, tDisorders, tDefaultDisorders)}
                    {avatar.age ? ` · ${avatar.age}` : ""}
                    {avatar.gender ? ` · ${genderLabel(avatar.gender)}` : ""}
                  </p>
                </div>
                <span className="status-chip status-chip-active">
                  {tCommon("active")}
                </span>
              </div>
              {localeNativeNames(avatar.available_locales).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {localeNativeNames(avatar.available_locales).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-variant)]"
                    >
                      <span aria-hidden className="material-symbols-outlined text-[14px]">
                        translate
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <ul className="space-y-2 text-sm text-[var(--on-surface-variant)]">
                {(avatar.ideal_guidelines?.session_goals ?? [])
                  .slice(0, 3)
                  .map((goal) => (
                    <li key={goal} className="flex gap-2">
                      <span aria-hidden className="material-symbols-outlined mt-0.5 text-[18px] text-[var(--primary)]">
                        check_circle
                      </span>
                      <span>{sessionGoalText(goal, tGoals)}</span>
                    </li>
                  ))}
              </ul>
              {(() => {
                const course = courseByAvatar.get(avatar.id);
                if (!course) return <StartSessionButton avatarId={avatar.id} />;
                const { progress } = course;
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-container-high)] px-3 py-2 text-xs">
                      <span className="font-semibold text-[var(--on-surface)]">
                        {progress.planRequired
                          ? tCourse("planRequiredTitle")
                          : tCourse("nextSession", {
                              n: progress.nextSessionNumber,
                              total: course.planned,
                            })}
                      </span>
                      <Link
                        href={`/courses/${course.id}`}
                        className="font-medium text-[var(--primary)] hover:underline"
                      >
                        {tCourse("openCourse")}
                      </Link>
                    </div>
                    {progress.canStartNext ? (
                      <StartSessionButton avatarId={avatar.id} />
                    ) : (
                      <Link
                        href={`/courses/${course.id}#plan`}
                        className="btn-primary w-full"
                      >
                        <span aria-hidden className="material-symbols-outlined text-[20px]">
                          assignment
                        </span>
                        {progress.planRequired
                          ? tCourse("planRequiredCta")
                          : tCourse("openCourse")}
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>
          </article>
        ))}
      </div>

      <section className="mt-12 fade-in-up" aria-labelledby="practice-title">
        <h2
          id="practice-title"
          className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]"
        >
          {tPractice("title")}
        </h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {tPractice("intro")}
        </p>
        <PracticeScenarioPicker
          disorders={practiceDisorders}
          patients={list.map((a) => ({ id: a.id, name: a.name }))}
        />
      </section>
    </main>
  );
}
