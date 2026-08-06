"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { AppLocale } from "@/i18n/config";
import type { ClinicAppointmentCard } from "@/lib/therapy-room";

function formatSlot(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar" : "en", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function urgencyClass(u: string) {
  if (u === "emergent") return "text-[var(--error)]";
  if (u === "urgent") return "text-amber-700";
  if (u === "soon") return "text-[var(--secondary)]";
  return "text-[var(--on-surface-variant)]";
}

export type ClinicDashboardInitial = {
  clinicDay: {
    id: string;
    date: string;
    closedAt: string | null;
    summary: unknown;
    reflectionJournal: string | null;
  };
  appointments: ClinicAppointmentCard[];
  unreadSupervisorMessages: number;
  outstandingTasks: string[];
};

export function ClinicDashboard({
  initial,
}: {
  initial: ClinicDashboardInitial;
}) {
  const t = useTranslations("clinic");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const clinicDayId = initial.clinicDay.id;
  const appointments = initial.appointments;
  const unread = initial.unreadSupervisorMessages;
  const tasks = initial.outstandingTasks;

  async function openChart(appt: ClinicAppointmentCard) {
    router.push(`/clinic/chart/${appt.id}`);
  }

  async function closeDay() {
    if (!clinicDayId || closing) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/clinic/day/${clinicDayId}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("closeFailed"));
        setClosing(false);
        return;
      }
      router.push(`/clinic/day-end?day=${clinicDayId}`);
    } catch {
      setError(t("networkError"));
      setClosing(false);
    }
  }

  return (
    <main className="clinic-atmosphere mx-auto min-h-[70vh] max-w-4xl px-4 py-10 md:px-8">
      <header className="mb-10 fade-in-up">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
          {t("centerName")}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)] md:text-4xl">
          {t("dashboardTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-[var(--on-surface-variant)]">
          {t("dashboardSubtitle")}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--on-surface-variant)]">
          {unread > 0 && (
            <span>{t("unreadSupervisor", { count: unread })}</span>
          )}
          {tasks.length > 0 && (
            <span>{t("outstandingCount", { count: tasks.length })}</span>
          )}
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}

      <section aria-label={t("todaysAppointments")} className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
          {t("todaysAppointments")}
        </h2>
        {appointments.length === 0 ? (
          <p className="text-[var(--on-surface-variant)]">{t("emptySchedule")}</p>
        ) : (
          <ul className="divide-y divide-[var(--outline-variant)] border-y border-[var(--outline-variant)]">
            {appointments.map((appt) => (
              <li
                key={appt.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <time
                      dateTime={appt.scheduledAt}
                      className="font-medium tabular-nums text-[var(--on-surface)]"
                    >
                      {formatSlot(appt.scheduledAt, locale)}
                    </time>
                    <span className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                      {appt.patientDisplay}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-[var(--on-surface-variant)]">
                      {appt.patientInitials}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase ${urgencyClass(appt.urgency)}`}
                    >
                      {t(`urgency.${appt.urgency}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {t("sessionNumber", { n: appt.sessionNumber })}
                    {" · "}
                    {appt.referralSource}
                    {appt.diagnosis ? ` · ${appt.diagnosis}` : ""}
                    {" · "}
                    {appt.previousAttendance}
                  </p>
                  {appt.currentMedications && (
                    <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                      {t("medications")}: {appt.currentMedications}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {appt.status === "completed" && appt.sessionId ? (
                    <Link
                      href={`/clinic/room/${appt.sessionId}/debrief`}
                      className="btn-secondary h-10 px-4"
                    >
                      {t("reviewVisit")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary h-10 px-4"
                      onClick={() => void openChart(appt)}
                    >
                      {t("openChart")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary h-11 px-5"
          disabled={closing || !clinicDayId}
          onClick={() => void closeDay()}
        >
          {closing ? t("closingDay") : t("endOfDay")}
        </button>
        <Link href="/avatars" className="btn-secondary h-11 px-5">
          {t("patientLibrary")}
        </Link>
      </div>
    </main>
  );
}
