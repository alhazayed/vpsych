"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppLocale } from "@/i18n/config";
import { LOCALE_COOKIE } from "@/i18n/config";
import type { PreSessionChart } from "@/lib/therapy-room";

function cookieLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function PreSessionChartView({
  appointmentId,
  avatarId,
  difficulty,
  chart,
}: {
  appointmentId: string;
  avatarId: string;
  difficulty: string;
  chart: PreSessionChart;
}) {
  const t = useTranslations("clinic");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invitePatient() {
    setStarting(true);
    setError(null);
    try {
      const sessionLocale = locale || cookieLocale();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          locale: sessionLocale,
          difficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("startFailed"));
        setStarting(false);
        return;
      }

      await fetch(`/api/clinic/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_session",
          sessionId: data.sessionId,
        }),
      });

      router.push(`/clinic/room/${data.sessionId}?arrive=1`);
    } catch {
      setError(t("networkError"));
      setStarting(false);
    }
  }

  return (
    <main className="clinic-atmosphere mx-auto max-w-2xl px-4 py-10 md:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
        {t("preSession")}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold">
        {t("chartTitle", { name: chart.patientDisplay })}
      </h1>
      <p className="mt-2 text-[var(--on-surface-variant)]">
        {t("chartSubtitle")}
      </p>

      <div className="mt-8 space-y-6 text-[var(--on-surface)]">
        {chart.referralLetter && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.referral")}
            </h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">
              {chart.referralLetter}
            </p>
          </section>
        )}
        {chart.chiefComplaint && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.chief")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.chiefComplaint}</p>
          </section>
        )}
        {chart.riskAlerts.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--error)]">
              {t("sections.risk")}
            </h2>
            <ul className="mt-2 list-disc space-y-1 ps-5">
              {chart.riskAlerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        )}
        {chart.previousSummary && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.previous")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.previousSummary}</p>
          </section>
        )}
        {chart.currentMedication && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.medication")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.currentMedication}</p>
          </section>
        )}
        {chart.previousTherapistNotes && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.notes")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.previousTherapistNotes}</p>
          </section>
        )}
        {chart.homeworkStatus && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.homework")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.homeworkStatus}</p>
          </section>
        )}
        {chart.diagnosis && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              {t("sections.diagnosis")}
            </h2>
            <p className="mt-2 leading-relaxed">{chart.diagnosis}</p>
          </section>
        )}
        <p className="text-sm text-[var(--on-surface-variant)]">
          {t("sessionNumber", { n: chart.sessionNumber })}
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary h-12 px-6"
          disabled={starting}
          onClick={() => void invitePatient()}
        >
          {starting ? t("inviting") : t("invitePatient")}
        </button>
        <button
          type="button"
          className="btn-secondary h-12 px-6"
          onClick={() => router.push("/clinic")}
        >
          {t("backToBoard")}
        </button>
      </div>
    </main>
  );
}
