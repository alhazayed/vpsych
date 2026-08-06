"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SupervisorBriefing } from "@/lib/therapy-room";

export function SupervisorOffice({
  sessionId,
  briefing,
}: {
  sessionId: string;
  briefing: SupervisorBriefing;
}) {
  const t = useTranslations("clinic.supervisor");

  return (
    <main className="clinic-atmosphere mx-auto max-w-2xl px-4 py-10 md:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
        {t("office")}
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold">
        {t("title")}
      </h1>
      <p className="mt-2 text-[var(--on-surface-variant)]">{t("subtitle")}</p>

      <div className="mt-8 space-y-8">
        <Block title={t("whatHappened")} body={briefing.whatHappened} />
        <Block title={t("whyBehaved")} body={briefing.whyPatientBehaved} />
        <List title={t("missed")} items={briefing.missedOpportunities} />
        <List title={t("strengths")} items={briefing.strengths} />
        <List title={t("alternatives")} items={briefing.alternativeInterventions} />
        <List title={t("pearls")} items={briefing.clinicalPearls} />
        <List title={t("evidence")} items={briefing.evidenceBasedRecommendations} />
        <List title={t("literature")} items={briefing.relevantLiterature} />
        <List title={t("competency")} items={briefing.competencyProgression} />
        <List title={t("reflect")} items={briefing.reflectiveQuestions} />
        <Block title={t("plan")} body={briefing.improvementPlan} />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/clinic" className="btn-primary h-11 px-5">
          {t("backToClinic")}
        </Link>
        <Link
          href={`/clinic/room/${sessionId}/debrief`}
          className="btn-secondary h-11 px-5"
        >
          {t("backToDebrief")}
        </Link>
      </div>
    </main>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[var(--on-surface-variant)]">
        {body}
      </p>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
        {title}
      </h2>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-[var(--on-surface-variant)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
