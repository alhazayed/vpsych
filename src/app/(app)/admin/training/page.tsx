import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState, ErrorState, MetricCard } from "@/components/admin/AdminUi";
import {
  LADDER_LEVEL_COUNT,
  loadAllLadderAttempts,
  loadLadderProgramPatients,
  summarizeTraineeLadders,
} from "@/lib/training-ladder";

/**
 * Every trainee's ladder: one row per trainee who started the program, one
 * column per program patient with the levels cleared. Progress comes from
 * attempts the database graded; nothing here changes it.
 */
export default async function AdminTrainingPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.training");
  const tHome = await getTranslations("admin.home");
  const format = await getFormatter();

  const [program, loaded] = await Promise.all([
    loadLadderProgramPatients(supabase, await getLocale()),
    loadAllLadderAttempts(supabase),
  ]);

  const header = (
    <AdminPageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tHome("title"), href: "/admin" }, { label: t("title") }]}
      actions={
        <Link href="/admin/certificates" className="btn-secondary">
          {t("certificatesLink")}
        </Link>
      }
    />
  );

  if (!program.available || !loaded.available) {
    return (
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
        {header}
        <ErrorState title={t("loadErrorTitle")} description={t("loadErrorDescription")} />
      </main>
    );
  }

  const ladders = summarizeTraineeLadders(loaded.attempts);
  const ids = ladders.map((l) => l.therapistId);
  const names = new Map<string, string>();
  let namesFailed = false;
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids.slice(i, i + 100));
    if (error) {
      console.warn("[admin/training] trainee names load failed", { error: error.message });
      namesFailed = true;
      break;
    }
    for (const p of data ?? []) {
      if (p.display_name?.trim()) names.set(p.id, p.display_name.trim());
    }
  }
  const nameOf = (id: string) => names.get(id) ?? t("unnamed");
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
      {header}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t("statTrainees")}
          value={String(ladders.length)}
          hint={t("statTraineesHint")}
        />
        <MetricCard
          label={t("statCleared")}
          value={String(ladders.reduce((sum, l) => sum + l.clearedLevels, 0))}
          hint={t("statClearedHint", {
            total: program.patients.length * LADDER_LEVEL_COUNT,
          })}
        />
        <MetricCard
          label={t("statAwaiting")}
          value={String(ladders.reduce((sum, l) => sum + l.awaitingScore, 0))}
          hint={t("statAwaitingHint")}
        />
      </section>

      {namesFailed ? (
        <p role="alert" className="clinical-card p-4 text-sm text-[var(--error)]">
          {t("namesFailed")}
        </p>
      ) : null}
      {loaded.truncated ? (
        <p role="status" className="clinical-card p-4 text-sm text-[var(--on-surface-variant)]">
          {t("truncated", { count: loaded.attempts.length })}
        </p>
      ) : null}

      <section className="clinical-card overflow-hidden">
        {ladders.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} icon="stairs" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  <th scope="col" className="px-4 py-3 text-start md:px-6">
                    {t("colTrainee")}
                  </th>
                  {program.patients.map(({ patient, avatar }) => (
                    <th key={patient.key} scope="col" className="px-2 py-3 text-center">
                      <span aria-hidden title={avatar.display_name}>
                        {pad(patient.slot)}
                      </span>
                      <span className="sr-only">{avatar.display_name}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-start">
                    {t("colLastAttempt")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {ladders.map((l) => (
                  <tr key={l.therapistId} className="hover:bg-[var(--surface-container-low)]">
                    <th scope="row" className="px-4 py-3 text-start font-medium md:px-6">
                      <Link
                        href={`/admin/training/${l.therapistId}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {nameOf(l.therapistId)}
                      </Link>
                    </th>
                    {program.patients.map(({ patient, avatar }) => {
                      const entry = l.patients[patient.key];
                      return (
                        <td key={patient.key} className="px-2 py-3 text-center tabular-nums">
                          {entry ? (
                            <span
                              className={
                                entry.progress.completed
                                  ? "font-semibold text-[var(--primary)]"
                                  : undefined
                              }
                            >
                              <span aria-hidden>
                                {entry.progress.clearedCount}/{LADDER_LEVEL_COUNT}
                              </span>
                              <span className="sr-only">
                                {t("cellLabel", {
                                  patient: avatar.display_name,
                                  cleared: entry.progress.clearedCount,
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[var(--outline)]">
                              <span aria-hidden>—</span>
                              <span className="sr-only">
                                {t("cellNotStarted", { patient: avatar.display_name })}
                              </span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                      {format.dateTime(new Date(l.lastAttemptAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ladders.length > 0 ? (
        <section className="clinical-card p-4 text-xs text-[var(--on-surface-variant)]">
          <h2 className="mb-2 font-semibold text-[var(--on-surface)]">{t("legend")}</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {program.patients.map(({ patient, avatar }) => (
              <li key={patient.key}>
                <span className="tabular-nums">{pad(patient.slot)}</span> {avatar.display_name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
