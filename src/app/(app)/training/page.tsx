import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { expireStaleSessionsForTherapist } from "@/lib/session-expiry";
import {
  LADDER_LEVEL_COUNT,
  ladderLevelDef,
  loadLadderOverview,
  type LadderPatientOverview,
} from "@/lib/training-ladder";
import { LadderLevelList } from "@/components/training/LadderLevelList";
import { PatientPortrait } from "@/components/training/PatientPortrait";

/**
 * Training program dashboard: every program patient with the trainee's level
 * on its five-level ladder. Progress comes from attempts the database graded;
 * nothing here can change it.
 */
export default async function TrainingPage() {
  const { supabase, user } = await requireProfile();
  const t = await getTranslations("training");
  const tDisorders = await getTranslations("skillTests.disorders");

  await expireStaleSessionsForTherapist(supabase, user.id);
  const overview = await loadLadderOverview(supabase, user.id);

  const pad = (n: number) => String(n).padStart(2, "0");
  const disorderLabel = (slug: string) =>
    tDisorders.has(slug) ? tDisorders(slug) : slug;
  const genderLabel = (g: string | null) =>
    g === "female" || g === "male" ? t(`gender.${g}`) : t("gender.other");
  const status = (p: LadderPatientOverview) =>
    p.progress.completed
      ? { label: t("status.completed"), chip: "status-chip-done" }
      : p.attempts.length > 0
        ? { label: t("status.inProgress"), chip: "status-chip-active" }
        : { label: t("status.notStarted"), chip: "" };

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--on-surface-variant)]">
          {t("intro")}
        </p>
        {overview.available && overview.patients.length > 0 ? (
          <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
            {t("summary", {
              patients: overview.patients.length,
              levels: overview.patients.length * LADDER_LEVEL_COUNT,
            })}
          </p>
        ) : null}
      </section>

      {!overview.available ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("unavailable")}
        </p>
      ) : overview.patients.length === 0 ? (
        <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
          {t("empty")}
        </p>
      ) : (
        <>
          <section className="clinical-card mb-6 overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--on-surface-variant)]">
                <tr className="border-b border-[var(--outline-variant)]">
                  <th scope="col" className="px-4 py-3 text-start">{t("table.patient")}</th>
                  <th scope="col" className="px-4 py-3 text-start">{t("table.primary")}</th>
                  <th scope="col" className="px-4 py-3 text-start">{t("table.level")}</th>
                  <th scope="col" className="px-4 py-3 text-start">{t("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.patients.map((p) => {
                  const s = status(p);
                  return (
                    <tr key={p.patient.key} className="border-b border-[var(--outline-variant)] last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/training/${p.patient.key}`} className="font-semibold text-[var(--primary)] hover:underline">
                          {t("patientTitle", { n: pad(p.patient.slot), name: p.avatar.name })}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{disorderLabel(p.patient.primaryDisorderSlug)}</td>
                      <td className="px-4 py-3">
                        {p.progress.completed
                          ? t("allCleared")
                          : t(`levels.${ladderLevelDef(p.progress.currentLevel).key}`)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`status-chip ${s.chip}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            {overview.patients.map((p) => (
              <article key={p.patient.key} className="clinical-card overflow-hidden">
                <div className="flex items-center gap-4 border-b border-[var(--outline-variant)] p-5">
                  <PatientPortrait name={p.avatar.name} portraitUrl={p.avatar.portrait_url} />
                  <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                      {t("patientTitle", { n: pad(p.patient.slot), name: p.avatar.name })}
                    </h2>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {t("identity", {
                        gender: genderLabel(p.avatar.gender),
                        age: p.avatar.age ?? "—",
                      })}
                    </p>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {t("primary", { disorder: disorderLabel(p.patient.primaryDisorderSlug) })}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-sm font-semibold">
                    {p.progress.completed
                      ? t("allCleared")
                      : t("currentLevel", {
                          level: t(`levels.${ladderLevelDef(p.progress.currentLevel).key}`),
                        })}
                  </p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {t("progress", { cleared: p.progress.clearedCount })}
                  </p>
                  <LadderLevelList progress={p.progress} compact />
                  <Link href={`/training/${p.patient.key}`} className="btn-primary w-full">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden>
                      stairs
                    </span>
                    {t("open")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
