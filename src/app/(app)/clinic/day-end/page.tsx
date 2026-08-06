import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import { closeClinicDay } from "@/lib/therapy-room/close-day";

type Props = { searchParams: Promise<{ day?: string }> };

export default async function ClinicDayEndPage({ searchParams }: Props) {
  if (!isTherapyRoomEnabled()) redirect("/avatars");
  const { day: dayId } = await searchParams;
  const { supabase, user } = await requireProfile();
  const t = await getTranslations("clinic.endOfDay");

  if (!dayId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-[var(--error)]">{t("missingDay")}</p>
        <Link href="/clinic" className="btn-primary mt-6 inline-flex h-11 px-5">
          {t("backToClinic")}
        </Link>
      </main>
    );
  }

  const result = await closeClinicDay(supabase, {
    dayId,
    therapistId: user.id,
  });

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-[var(--error)]">{t("loadFailed")}</p>
        <Link href="/clinic" className="btn-primary mt-6 inline-flex h-11 px-5">
          {t("backToClinic")}
        </Link>
      </main>
    );
  }

  const summary = result.summary;

  return (
    <main className="clinic-atmosphere mx-auto max-w-2xl px-4 py-10 md:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
        {t("badge")}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold">
        {t("title")}
      </h1>
      <p className="mt-2 text-[var(--on-surface-variant)]">{t("subtitle")}</p>

      <div className="mt-8 space-y-6">
        <p className="text-lg">
          {t("patientsSeen", { count: summary.patientsSeen })}
        </p>
        {summary.riskEvents.length > 0 && (
          <section>
            <h2 className="font-semibold">{t("riskEvents")}</h2>
            <ul className="mt-2 list-disc ps-5 text-[var(--on-surface-variant)]">
              {summary.riskEvents.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
        {summary.learningObjectivesAchieved.length > 0 && (
          <section>
            <h2 className="font-semibold">{t("objectives")}</h2>
            <ul className="mt-2 list-disc ps-5 text-[var(--on-surface-variant)]">
              {summary.learningObjectivesAchieved.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2 className="font-semibold">{t("reflection")}</h2>
          <p className="mt-2 text-[var(--on-surface-variant)]">
            {summary.reflectionJournal}
          </p>
        </section>
        {summary.recommendedStudyTopics.length > 0 && (
          <section>
            <h2 className="font-semibold">{t("study")}</h2>
            <ul className="mt-2 list-disc ps-5 text-[var(--on-surface-variant)]">
              {summary.recommendedStudyTopics.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h2 className="font-semibold">{t("visits")}</h2>
          <ul className="mt-2 divide-y divide-[var(--outline-variant)]">
            {summary.appointmentSummaries.map((a, i) => (
              <li
                key={`${a.patientDisplay}-${i}`}
                className="flex justify-between py-2 text-sm"
              >
                <span>{a.patientDisplay}</span>
                <span className="text-[var(--on-surface-variant)]">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Link href="/clinic" className="btn-primary mt-10 inline-flex h-11 px-5">
        {t("backToClinic")}
      </Link>
    </main>
  );
}
