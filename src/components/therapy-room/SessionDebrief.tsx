"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SupervisorBriefing } from "@/lib/therapy-room";

type TranscriptRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export function SessionDebrief({
  sessionId,
  briefing,
  transcript,
}: {
  sessionId: string;
  briefing: SupervisorBriefing;
  transcript: TranscriptRow[];
}) {
  const t = useTranslations("clinic.debrief");
  const [showTranscript, setShowTranscript] = useState(false);

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
        <section>
          <h2 className="font-semibold">{t("whatHappened")}</h2>
          <p className="mt-2 leading-relaxed text-[var(--on-surface-variant)]">
            {briefing.whatHappened}
          </p>
        </section>
        <section>
          <h2 className="font-semibold">{t("reflection")}</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[var(--on-surface-variant)]">
            {briefing.reflectiveQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">{t("reading")}</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[var(--on-surface-variant)]">
            {briefing.relevantLiterature.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/clinic/room/${sessionId}/supervisor`}
          className="btn-primary h-11 px-5"
        >
          {t("meetSupervisor")}
        </Link>
        <button
          type="button"
          className="btn-secondary h-11 px-5"
          onClick={() => setShowTranscript((v) => !v)}
        >
          {showTranscript ? t("hideTranscript") : t("showTranscript")}
        </button>
        <Link href="/clinic" className="btn-secondary h-11 px-5">
          {t("backToClinic")}
        </Link>
      </div>

      {showTranscript && (
        <ol className="mt-8 space-y-3 border-t border-[var(--outline-variant)] pt-6 text-sm">
          {transcript.map((m) => (
            <li key={m.id}>
              <span className="font-semibold">
                {m.role === "user" ? t("you") : t("patient")}:
              </span>{" "}
              <span className="text-[var(--on-surface-variant)]">{m.content}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
