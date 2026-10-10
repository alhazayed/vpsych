"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FIVE_PS, type FivePsFormulation } from "@/lib/types";
import type { CaseFormulationKey } from "@/lib/therapy-course/formulation-key";
import type {
  FivePReview,
  FormulationRating,
} from "@/lib/therapy-course/formulation-review";

const RATING_CLASS: Record<FormulationRating, string> = {
  matches: "text-[var(--primary)]",
  partial: "text-[var(--on-surface)]",
  missing: "text-[var(--error)]",
  contradicts: "text-[var(--error)]",
};

/** Admin-only: the trainee's 5 Ps beside the case's own, with an on-demand AI rating. */
export function FormulationReviewPanel({
  courseId,
  fivePs,
  caseKey,
}: {
  courseId: string;
  fivePs: FivePsFormulation | null;
  caseKey: CaseFormulationKey;
}) {
  const t = useTranslations("admin.formulationReview");
  const tP = useTranslations("course.fivePs");
  const locale = useLocale();
  const [items, setItems] = useState<FivePReview[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/formulation-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: locale === "ar" ? "ar" : "en" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        review?: { items?: FivePReview[] };
      };
      if (!res.ok || !data.review?.items) {
        setError(t("error"));
      } else {
        setItems(data.review.items);
      }
    } catch {
      setError(t("error"));
    } finally {
      setRunning(false);
    }
  }

  const byP = new Map((items ?? []).map((i) => [i.p, i]));

  return (
    <section className="clinical-card mb-4 space-y-4 p-5" aria-labelledby="formulation-review-title">
      <div>
        <h2
          id="formulation-review-title"
          className="font-[family-name:var(--font-headline)] text-lg font-semibold"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
      </div>

      {!fivePs ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("noFivePs")}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {FIVE_PS.map((p) => {
              const review = byP.get(p);
              return (
                <li key={p} className="rounded-lg border border-[var(--outline-variant)] p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--on-surface)]">
                      {tP(p)}
                    </h3>
                    {review && (
                      <span className={`text-xs font-semibold ${RATING_CLASS[review.rating]}`}>
                        {t(`ratings.${review.rating}`)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-[var(--on-surface-variant)]">
                        {t("trainee")}
                      </p>
                      <p className="whitespace-pre-wrap" dir="auto">
                        {fivePs[p]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--on-surface-variant)]">
                        {t("caseKey")}
                      </p>
                      {caseKey[p].length ? (
                        <ul className="list-disc space-y-0.5 ps-5" dir="auto">
                          {caseKey[p].map((k, i) => (
                            <li key={i}>{k}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[var(--on-surface-variant)]">{t("notSpecified")}</p>
                      )}
                    </div>
                  </div>
                  {review?.note && (
                    <p className="mt-2 text-sm text-[var(--on-surface)]" dir="auto">
                      {review.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="btn-secondary h-10"
            onClick={() => void run()}
            disabled={running}
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]">fact_check</span>
            {running ? t("running") : items ? t("rerun") : t("run")}
          </button>
          {error && (
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      <p className="text-xs text-[var(--on-surface-variant)]">{t("limitation")}</p>
    </section>
  );
}
