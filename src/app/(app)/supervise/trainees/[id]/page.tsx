import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSupervisor } from "@/lib/skill-tests/access";
import { isUuid } from "@/lib/skill-tests";
import { loadReportReviews } from "@/lib/supervisor-reviews";
import { logSecurityEvent } from "@/lib/security-audit";
import type { SessionStatus } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

type SessionRow = {
  id: string;
  status: SessionStatus;
  started_at: string;
  avatars: { name: string } | null;
};

/**
 * One linked trainee's practice sessions, for their supervisor (admins: any
 * trainee). Skill test sessions are left out: they belong to the supervisor
 * who assigned the test. RLS enforces both on every query.
 */
export default async function SupervisedTraineePage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase, user, isAdmin } = await requireSupervisor();
  const t = await getTranslations("supervisorReviews.trainee");
  const tPanel = await getTranslations("supervisorReviews.panel");
  const tStatus = await getTranslations("skillTests.status");
  const locale = await getLocale();

  if (!isAdmin) {
    const { data: link, error: linkError } = await supabase
      .from("supervisor_trainees")
      .select("trainee_id")
      .eq("supervisor_id", user.id)
      .eq("trainee_id", id)
      .maybeSingle();
    if (linkError) throw loadFailed("link", id, linkError);
    if (!link) notFound();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .maybeSingle();
  if (profileError) throw loadFailed("profile", id, profileError);
  if (!profile) notFound();

  await logSecurityEvent({
    action: "supervisor.trainee.view",
    outcome: "success",
    resourceType: "profile",
    resourceId: id,
  });

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, status, started_at, avatars(name)")
    .eq("therapist_id", id)
    .is("skill_test_assignment_id", null)
    .order("started_at", { ascending: false })
    .limit(200);
  if (sessionsError) throw loadFailed("sessions", id, sessionsError);
  const sessions = (sessionRows ?? []) as unknown as SessionRow[];
  const ids = sessions.map((s) => s.id);

  const { data: reportRows, error: reportsError } = ids.length
    ? await supabase.from("session_reports").select("session_id, scores").in("session_id", ids)
    : { data: [], error: null };
  if (reportsError) throw loadFailed("reports", id, reportsError);
  const aiScore = new Map(
    ((reportRows ?? []) as Array<{ session_id: string; scores: { overall?: number } | null }>).map(
      (r) => [r.session_id, r.scores?.overall ?? null],
    ),
  );
  const { reviews, failed: reviewsFailed } = await loadReportReviews(
    supabase,
    ids.filter((sid) => aiScore.has(sid)),
  );
  const mine = new Map(
    reviews.filter((r) => r.reviewer_id === user.id).map((r) => [r.session_id, r]),
  );

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 md:px-8">
      <Link
        href="/supervise"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px] rtl:rotate-180" aria-hidden>
          arrow_back
        </span>
        {t("back")}
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
        {t("title", { name: profile.display_name })}
      </h1>
      <p className="mb-6 mt-2 text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>

      {reviewsFailed && (
        <p role="alert" className="clinical-card mb-4 p-4 text-sm text-[var(--error)]">
          {tPanel("loadError")}
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="clinical-card p-8 text-center text-sm text-[var(--on-surface-variant)]">
          {t("empty")}
        </p>
      ) : (
        <ul className="clinical-card divide-y divide-[var(--outline-variant)]">
          {sessions.map((s) => {
            const hasReport = aiScore.has(s.id);
            const score = aiScore.get(s.id);
            const review = mine.get(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{s.avatars?.name ?? "—"}</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {dateFmt.format(new Date(s.started_at))} · {tStatus(`session_${s.status}`)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {hasReport && typeof score === "number" && (
                    <span>
                      {t("colAi")}: <span dir="ltr">{score}/100</span>
                    </span>
                  )}
                  {!hasReport ? (
                    <span className="text-[var(--on-surface-variant)]">{t("noReport")}</span>
                  ) : review ? (
                    <>
                      <span className="status-chip status-chip-done">{t("reviewed")}</span>
                      {review.adjusted_overall !== null && (
                        <span className="status-chip status-chip-active">
                          {t("adjustedTo", { score: review.adjusted_overall })}
                        </span>
                      )}
                      {review.flagged && <span className="status-chip">{t("flagged")}</span>}
                    </>
                  ) : (
                    <span className="text-[var(--on-surface-variant)]">{t("notReviewed")}</span>
                  )}
                  {hasReport && (
                    <Link
                      href={`/supervise/sessions/${s.id}`}
                      className="btn-secondary"
                    >
                      {t("open")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function loadFailed(what: string, traineeId: string, error: { message: string }): Error {
  console.error(`[supervise/trainee] ${what} load failed`, { traineeId, error: error.message });
  return new Error(`supervised_trainee_${what}_unavailable`);
}
