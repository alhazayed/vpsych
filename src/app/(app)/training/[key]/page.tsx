import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { expireStaleSessionsForTherapist } from "@/lib/session-expiry";
import {
  LADDER_LEVELS,
  attemptOutcome,
  findLadderPatient,
  ladderLevelDef,
  loadLadderOverview,
  numberAttempts,
} from "@/lib/training-ladder";
import { LadderLevelList } from "@/components/training/LadderLevelList";
import { PatientPortrait } from "@/components/training/PatientPortrait";
import { StartLadderLevelButton } from "@/components/training/StartLadderLevelButton";

type Props = { params: Promise<{ key: string }> };

/**
 * One patient's ladder: levels cleared and locked, the next objective, the
 * start button for the unlocked level, replays of cleared levels, and every
 * previous attempt with its score.
 */
export default async function TrainingPatientPage({ params }: Props) {
  const { key } = await params;
  if (!findLadderPatient(key)) notFound();
  const { supabase, user } = await requireProfile();
  const t = await getTranslations("training");
  const tDisorders = await getTranslations("skillTests.disorders");

  await expireStaleSessionsForTherapist(supabase, user.id);
  const overview = await loadLadderOverview(supabase, user.id);
  if (!overview.available) {
    return (
      <main className="mx-auto max-w-[880px] px-4 py-8 md:px-8">
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("unavailable")}
        </p>
      </main>
    );
  }
  const entry = overview.patients.find((p) => p.patient.key === key);
  if (!entry) notFound();
  const { patient, avatar, progress } = entry;

  const slug = patient.primaryDisorderSlug;
  const disorder = tDisorders.has(slug) ? tDisorders(slug) : slug;
  const gender =
    avatar.gender === "female" || avatar.gender === "male"
      ? t(`gender.${avatar.gender}`)
      : t("gender.other");
  const levelName = (level: number) =>
    t(`levels.${ladderLevelDef(level as 1 | 2 | 3 | 4 | 5).key}`);
  const current = ladderLevelDef(progress.currentLevel);
  const attempts = numberAttempts(entry.attempts).reverse();
  const live = entry.attempts.find(
    (a) => attemptOutcome(a) === "in_session",
  );

  return (
    <main className="mx-auto max-w-[880px] px-4 py-8 md:px-8">
      <Link
        href="/training"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px] rtl:rotate-180" aria-hidden>
          arrow_back
        </span>
        {t("back")}
      </Link>

      <section className="clinical-card mb-6 flex items-center gap-4 p-5 fade-in-up">
        <PatientPortrait name={avatar.name} portraitUrl={avatar.portrait_url} size={80} />
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold tracking-tight">
            {t("patientTitle", { n: String(patient.slot).padStart(2, "0"), name: avatar.name })}
          </h1>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("identity", { gender, age: avatar.age ?? "—" })}
          </p>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("primary", { disorder })}
          </p>
          <p className="mt-2 text-sm font-semibold">
            {progress.completed
              ? t("allCleared")
              : t("currentLevel", { level: t(`levels.${current.key}`) })}
          </p>
        </div>
      </section>

      <section className="clinical-card mb-6 p-5">
        <LadderLevelList progress={progress} />
      </section>

      <section className="clinical-card mb-6 space-y-3 p-5">
        {progress.completed ? (
          <>
            <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
              {t("completeTitle")}
            </h2>
            <p className="text-sm text-[var(--on-surface-variant)]">{t("completeBody")}</p>
          </>
        ) : (
          <>
            <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
              {t("nextObjective")}
            </h2>
            <p className="text-sm">{t(`objectives.${current.key}`)}</p>
          </>
        )}
        <p className="text-xs text-[var(--on-surface-variant)]">{t("passMark")}</p>
        {live ? (
          <Link href={`/sessions/${live.session_id}`} className="btn-primary w-full">
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              meeting_room
            </span>
            {t("resume")}
          </Link>
        ) : (
          <div className="space-y-3">
            {!progress.completed ? (
              <StartLadderLevelButton
                patientKey={patient.key}
                level={progress.currentLevel}
                label={t("start", { level: t(`levels.${current.key}`) })}
              />
            ) : null}
            {LADDER_LEVELS.filter(
              (l) => progress.levels[l.level - 1]!.state === "cleared",
            ).map((l) => (
              <StartLadderLevelButton
                key={l.key}
                patientKey={patient.key}
                level={l.level}
                label={t("replay", { level: t(`levels.${l.key}`) })}
                variant="secondary"
              />
            ))}
          </div>
        )}
      </section>

      <section className="clinical-card overflow-x-auto p-5">
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("attemptsTitle")}
        </h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">{t("attemptsEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-[var(--on-surface-variant)]">
              <tr className="border-b border-[var(--outline-variant)]">
                <th scope="col" className="py-2 text-start">{t("attempts.level")}</th>
                <th scope="col" className="py-2 text-end">{t("attempts.attempt")}</th>
                <th scope="col" className="py-2 text-end">{t("attempts.score")}</th>
                <th scope="col" className="py-2 text-start ps-4">{t("attempts.result")}</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const outcome = attemptOutcome(a);
                return (
                  <tr key={a.id} className="border-b border-[var(--outline-variant)] last:border-0">
                    <td className="py-2">{levelName(a.level)}</td>
                    <td className="py-2 text-end tabular-nums">{a.attemptNumber}</td>
                    <td className="py-2 text-end tabular-nums">
                      {a.score === null ? "—" : t("score", { score: a.score })}
                    </td>
                    <td className="py-2 ps-4">
                      <span aria-hidden>
                        {outcome === "passed" ? "✅ " : outcome === "failed" ? "❌ " : ""}
                      </span>
                      {outcome === "in_session" || outcome === "no_report" ? (
                        <Link href={`/sessions/${a.session_id}${outcome === "no_report" ? "/complete" : ""}`} className="text-[var(--primary)] hover:underline">
                          {t(`outcome.${outcome}`)}
                        </Link>
                      ) : (
                        t(`outcome.${outcome}`)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
