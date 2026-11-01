import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/admin/AdminUi";
import { LadderLevelList } from "@/components/training/LadderLevelList";
import { PatientPortrait } from "@/components/training/PatientPortrait";
import { isUuid } from "@/lib/skill-tests";
import {
  attemptOutcome,
  ladderLevelDef,
  ladderProgress,
  loadLadderAttempts,
  loadLadderProgramPatients,
  numberAttempts,
} from "@/lib/training-ladder";

type Props = { params: Promise<{ traineeId: string }> };

/**
 * One trainee's ladder with every program patient: levels cleared, each
 * attempt with its result, and links to the session and its admin report.
 */
export default async function AdminTraineeLadderPage({ params }: Props) {
  const { traineeId } = await params;
  if (!isUuid(traineeId)) notFound();
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.training");
  const tTraining = await getTranslations("training");
  const tDisorders = await getTranslations("skillTests.disorders");
  const tHome = await getTranslations("admin.home");
  const format = await getFormatter();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", traineeId)
    .maybeSingle();
  if (profileError) {
    console.error("[admin/training] trainee load failed", { error: profileError.message });
    throw new Error("trainee_unavailable");
  }
  if (!profile) notFound();
  const name = profile.display_name?.trim() || t("unnamed");

  const [program, attempts] = await Promise.all([
    loadLadderProgramPatients(supabase, await getLocale()),
    loadLadderAttempts(supabase, { therapistId: traineeId }),
  ]);

  const header = (
    <AdminPageHeader
      title={name}
      subtitle={t("detailSubtitle")}
      breadcrumbs={[
        { label: tHome("title"), href: "/admin" },
        { label: t("title"), href: "/admin/training" },
        { label: name },
      ]}
    />
  );

  if (!program.available || !attempts.available) {
    return (
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
        {header}
        <ErrorState title={t("loadErrorTitle")} description={t("loadErrorDescription")} />
      </main>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const levelName = (level: number) =>
    tTraining(`levels.${ladderLevelDef(level as 1 | 2 | 3 | 4 | 5).key}`);

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
      {header}

      {program.patients.map(({ patient, avatar }) => {
        const mine = attempts.attempts.filter((a) => a.patient_key === patient.key);
        const progress = ladderProgress(mine);
        const rows = numberAttempts(mine).reverse();
        return (
          <section key={patient.key} className="clinical-card space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <PatientPortrait name={avatar.display_name} portraitUrl={avatar.portrait_url} size={48} />
              <div className="min-w-0 flex-1">
                <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                  {tTraining("patientTitle", { n: pad(patient.slot), name: avatar.display_name })}
                </h2>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {tTraining("primary", {
                    disorder: tDisorders.has(patient.primaryDisorderSlug)
                      ? tDisorders(patient.primaryDisorderSlug)
                      : patient.primaryDisorderSlug,
                  })}
                </p>
              </div>
              <div>
                <LadderLevelList progress={progress} compact />
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {mine.length === 0
                    ? t("notStarted")
                    : tTraining("progress", { cleared: progress.clearedCount })}
                </p>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs uppercase tracking-wider text-[var(--on-surface-variant)]">
                    <tr className="border-b border-[var(--outline-variant)]">
                      <th scope="col" className="py-2 text-start">{tTraining("attempts.level")}</th>
                      <th scope="col" className="py-2 text-end">{tTraining("attempts.attempt")}</th>
                      <th scope="col" className="py-2 text-end">{tTraining("attempts.score")}</th>
                      <th scope="col" className="py-2 ps-4 text-start">{tTraining("attempts.result")}</th>
                      <th scope="col" className="py-2 text-start">{t("colStarted")}</th>
                      <th scope="col" className="py-2 text-end">{t("colLinks")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const outcome = attemptOutcome(a);
                      const hasReport =
                        outcome === "passed" ||
                        outcome === "failed" ||
                        outcome === "scoring" ||
                        outcome === "too_short";
                      return (
                        <tr key={a.id} className="border-b border-[var(--outline-variant)] last:border-0">
                          <td className="py-2">{levelName(a.level)}</td>
                          <td className="py-2 text-end tabular-nums">{a.attemptNumber}</td>
                          <td className="py-2 text-end tabular-nums">
                            {a.score === null ? "—" : tTraining("score", { score: a.score })}
                          </td>
                          <td className="py-2 ps-4">{tTraining(`outcome.${outcome}`)}</td>
                          <td className="py-2 text-[var(--on-surface-variant)]">
                            {format.dateTime(new Date(a.created_at), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="py-2 text-end">
                            <span className="inline-flex gap-3">
                              {hasReport ? (
                                <Link
                                  href={`/admin/reports/${a.session_id}`}
                                  className="text-[var(--primary)] hover:underline"
                                >
                                  {t("report")}
                                </Link>
                              ) : null}
                              <Link
                                href={`/admin/sessions/${a.session_id}`}
                                className="text-[var(--primary)] hover:underline"
                              >
                                {t("session")}
                              </Link>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
