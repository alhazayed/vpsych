import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSupervisor } from "@/lib/skill-tests/access";
import { isUuid } from "@/lib/skill-tests";
import { logSecurityEvent } from "@/lib/security-audit";
import { ReportView } from "@/components/ReportView";
import { SessionPracticePanel } from "@/components/admin/SessionPracticePanel";
import { CancelSkillTestButton } from "@/components/skill-tests/CancelSkillTestButton";
import {
  buildIndicativeCtsr,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateSessionPractice,
} from "@/lib/session-practice";
import type {
  SessionMessage,
  SessionReport,
  SkillTestAssignment,
  TherapySession,
} from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

type AssignmentRow = SkillTestAssignment & {
  trainee: { display_name: string } | null;
  avatars: { name: string } | null;
};

/**
 * Results of one skill test: the assigning supervisor and admins only. RLS
 * enforces that on every query below; this page adds an audit trail.
 */
export default async function SkillTestResultsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireSupervisor();
  const t = await getTranslations("skillTests.supervise");
  const tStatus = await getTranslations("skillTests.status");
  const tD = await getTranslations("skillTests.disorders");
  const tLevel = await getTranslations("skillTests.difficulty");
  const tSev = await getTranslations("skillTests.severity");
  const tTranscript = await getTranslations("therapyRoom.transcript");
  const locale = await getLocale();

  const { data: row } = await supabase
    .from("skill_test_assignments")
    .select(
      "*, trainee:profiles!skill_test_assignments_trainee_id_fkey(display_name), avatars(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const test = row as unknown as AssignmentRow;

  await logSecurityEvent({
    action: "skill_test.results.view",
    outcome: "success",
    resourceType: "skill_test",
    resourceId: id,
  });

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, status, started_at, ended_at, test_session_number")
    .eq("skill_test_assignment_id", id)
    .order("started_at", { ascending: true });
  const sessions = (sessionRows ?? []) as Pick<
    TherapySession,
    "id" | "status" | "started_at" | "ended_at" | "test_session_number"
  >[];
  const sessionIds = sessions.map((s) => s.id);

  const [{ data: reportRows }, { data: messageRows }] = sessionIds.length
    ? await Promise.all([
        supabase.from("session_reports").select("*").in("session_id", sessionIds),
        supabase
          .from("session_messages")
          .select("id, session_id, role, content, created_at")
          .in("session_id", sessionIds)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];
  const reports = new Map(
    ((reportRows ?? []) as SessionReport[]).map((r) => [r.session_id, r]),
  );
  const messages = (messageRows ?? []) as SessionMessage[];

  const core = test.clinical_snapshot?.clinical_core ?? null;
  const selfReport = core ? deriveSelfReportProfile(core) : null;
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const open = test.status === "assigned" || test.status === "in_progress";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        href="/supervise"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px] rtl:rotate-180" aria-hidden>
          arrow_back
        </span>
        {t("back")}
      </Link>

      {created === "1" && (
        <p role="status" className="clinical-card mt-4 p-4 text-sm">
          {t("created", { name: test.trainee?.display_name ?? "—" })}
        </p>
      )}

      <section className="clinical-card mt-4 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold">
              {test.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {t("rowMeta", {
                trainee: test.trainee?.display_name ?? "—",
                patient: test.avatars?.name ?? "—",
              })}
            </p>
          </div>
          <span className="status-chip">{tStatus(test.status)}</span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">{t("specDisorder")}</dt>
            <dd>{tD(test.disorder_slug)}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("specComorbidities")}</dt>
            <dd>
              {test.comorbidity_slugs.length
                ? test.comorbidity_slugs.map((s) => tD(s)).join(locale === "ar" ? "، " : ", ")
                : t("none")}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t("specDifficulty")}</dt>
            <dd>
              {tLevel(test.difficulty)}
              {test.severity ? ` · ${tSev(test.severity)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t("specSessions")}</dt>
            <dd>
              {t("sessionsHeld", { held: sessions.length, total: test.required_sessions })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t("specLanguage")}</dt>
            <dd>{test.language === "ar-JO" ? t("languageAr") : t("languageEn")}</dd>
          </div>
          {test.due_at && (
            <div>
              <dt className="font-semibold">{t("specDue")}</dt>
              <dd>{dateFmt.format(new Date(test.due_at))}</dd>
            </div>
          )}
        </dl>
        {test.trainee_instructions && (
          <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-container-high)] p-3 text-sm">
            {test.trainee_instructions}
          </p>
        )}
        {open && <CancelSkillTestButton skillTestId={test.id} />}
      </section>

      <h2 className="mb-3 mt-8 font-[family-name:var(--font-headline)] text-xl font-semibold">
        {t("resultsTitle")}
      </h2>
      <p className="mb-4 text-xs text-[var(--on-surface-variant)]">{t("resultsPrivacy")}</p>

      {sessions.length === 0 ? (
        <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
          {t("noSessions")}
        </p>
      ) : (
        <div className="space-y-8">
          {sessions.map((s, index) => {
            const transcript = messages.filter((m) => m.session_id === s.id);
            const report = reports.get(s.id);
            const practice = evaluateSessionPractice({
              messages: transcript,
              riskPresent: caseHasRisk(core?.risk_profile),
            });
            const ctsr = buildIndicativeCtsr({
              items: report?.scores?.items ?? [],
              practice,
            });
            return (
              <section key={s.id} className="space-y-4" aria-label={t("sessionN", { n: s.test_session_number ?? index + 1 })}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                    {t("sessionN", { n: s.test_session_number ?? index + 1 })}
                  </h3>
                  <span className="text-sm text-[var(--on-surface-variant)]">
                    {dateFmt.format(new Date(s.started_at))} · {tStatus(`session_${s.status}`)}
                  </span>
                </div>
                {report ? (
                  <ReportView report={report} />
                ) : (
                  <p className="clinical-card p-4 text-sm text-[var(--on-surface-variant)]">
                    {s.status === "active" ? t("sessionRunning") : t("reportPending")}
                  </p>
                )}
                {transcript.length > 0 && (
                  <SessionPracticePanel practice={practice} ctsr={ctsr} selfReport={selfReport} />
                )}
                <details className="clinical-card p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t("transcript", { count: transcript.length })}
                  </summary>
                  {transcript.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                      {tTranscript("empty")}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3 text-sm">
                      {transcript.map((m) => (
                        <li key={m.id}>
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                            {m.role === "user"
                              ? test.trainee?.display_name ?? t("traineeLabel")
                              : test.avatars?.name ?? tTranscript("patient")}
                          </span>
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
