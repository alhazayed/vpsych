import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import { expireStaleSessionsForTherapist } from "@/lib/session-expiry";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import type { TherapySession } from "@/lib/types";
import { format } from "date-fns";
import { ErrorState } from "@/components/admin/AdminUi";

export default async function SessionsListPage() {
  const { supabase, user, profile } = await requireProfile();
  const t = await getTranslations("sessions");

  // Abandoned rooms past max_duration_sec should not linger as "active".
  await expireStaleSessionsForTherapist(supabase, user.id);

  // Prefer interaction_mode (Therapy Room Mode). ui_mode is optional VMHC
  // column — selecting it alone 400s the whole list when the migration is absent.
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    // `*` so therapy-course columns appear when present without 400-ing the
    // list on a database that has not applied that migration yet.
    .select("*, avatars(name, disorder)")
    .eq("therapist_id", user.id)
    .order("started_at", { ascending: false });
  if (sessionsError) {
    console.warn("[sessions] list:", sessionsError.message);
  }

  const raw =
    (sessions as
      | (Pick<
          TherapySession,
          | "id"
          | "status"
          | "started_at"
          | "ended_at"
          | "interaction_mode"
          | "clinical_snapshot"
          | "avatar_id"
          | "therapy_course_id"
          | "course_session_number"
          | "skill_test_assignment_id"
        > & {
          avatars: { name: string; disorder: string };
        })[]
      | null) ?? [];

  // Learner-facing history must not present admin-test rows as training assessments.
  // Admins still see their test sessions, clearly badged. Skill test sessions
  // live on the Skill tests page; their results belong to the supervisor.
  const list =
    profile.role === "admin"
      ? raw
      : raw.filter(
          (s) =>
            !isAdminTestSnapshot(s.clinical_snapshot) &&
            !s.skill_test_assignment_id,
        );

  const therapyRoom = isTherapyRoomEnabled();

  // Therapy courses (empty when the table is missing).
  const { data: courseRows } = await supabase
    .from("therapy_courses")
    .select("id, status, planned_sessions, updated_at, avatars(name)")
    .eq("therapist_id", user.id)
    .order("updated_at", { ascending: false });
  const courses = (courseRows ?? []).map((c) => {
    const av = c.avatars as { name: string } | { name: string }[] | null;
    return {
      id: c.id as string,
      status: c.status as string,
      planned: c.planned_sessions as number,
      name: (Array.isArray(av) ? av[0]?.name : av?.name) ?? "",
      held: list.filter((s) => s.therapy_course_id === c.id).length,
    };
  });
  const tCourse = await getTranslations("course");

  function statusLabel(status: string) {
    if (status === "active") return t("status.active");
    if (status === "completed") return t("status.completed");
    if (status === "expired") return t("status.expired");
    return status;
  }

  function sessionHref(s: (typeof list)[number]) {
    const adminTest = isAdminTestSnapshot(s.clinical_snapshot);
    const isRoom = s.interaction_mode === "therapy_room";
    if (s.status === "active") {
      if (therapyRoom && isRoom) {
        return `/clinic/room/${s.id}`;
      }
      return `/sessions/${s.id}`;
    }
    if (adminTest) {
      return `/admin/avatars/${s.avatar_id}`;
    }
    if (therapyRoom && isRoom) {
      return `/clinic/room/${s.id}/debrief`;
    }
    return `/sessions/${s.id}/complete`;
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>

      {sessionsError ? (
        <div className="mb-6">
          <ErrorState
            title={t("loadErrorTitle")}
            description={t("loadErrorDescription")}
          />
        </div>
      ) : null}
      {courses.length > 0 && (
        <section className="clinical-card mb-6 overflow-hidden">
          <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              {tCourse("coursesTitle")}
            </p>
          </div>
          <ul className="divide-y divide-[var(--surface-container-low)]">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--on-surface)]">{c.name}</p>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {tCourse("sessionsHeld", { count: c.held })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`status-chip ${
                      c.status === "active" ? "status-chip-active" : "status-chip-done"
                    }`}
                  >
                    {c.status === "active"
                      ? tCourse("statusActive")
                      : tCourse("statusCompleted")}
                  </span>
                  <Link
                    href={`/courses/${c.id}`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    {tCourse("openCourse")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {t("history")}
          </p>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {list.map((s) => {
            const adminTest = isAdminTestSnapshot(s.clinical_snapshot);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--surface-container-low)]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--on-surface)]">
                    {s.avatars?.name} · {s.avatars?.disorder}
                  </p>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {s.course_session_number
                      ? `${tCourse("sessionBadge", { n: s.course_session_number })} · `
                      : ""}
                    {format(new Date(s.started_at), "MMM d, yyyy · HH:mm")}
                    {adminTest ? ` · ${t("adminTestHint")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {adminTest ? (
                    <span className="status-chip status-chip-warn">
                      {t("adminTestBadge")}
                    </span>
                  ) : null}
                  <span
                    className={`status-chip ${
                      s.status === "active"
                        ? "status-chip-warn"
                        : "status-chip-done"
                    }`}
                  >
                    {statusLabel(s.status)}
                  </span>
                  <Link
                    href={sessionHref(s)}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    {s.status === "active" ? t("resume") : t("details")}
                  </Link>
                </div>
              </li>
            );
          })}
          {!list.length && !sessionsError && (
            <li className="px-6 py-10 text-sm text-[var(--on-surface-variant)]">
              {t("empty")}{" "}
              <Link
                href="/avatars"
                className="font-medium text-[var(--primary)] underline"
              >
                {t("emptyCta")}
              </Link>
              .
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
