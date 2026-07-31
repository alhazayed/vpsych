import { getTranslations } from "next-intl/server";
import type { SessionReport } from "@/lib/types";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";

export async function ReportView({ report }: { report: SessionReport }) {
  const tCommon = await getTranslations("common");
  const items = report.scores?.items ?? [];
  const overall = report.scores?.overall ?? 0;
  const language = normalizeReportLanguage(report.language);
  const isAr = language === "ar";

  const labels = isAr
    ? {
        confidential: "تقييم سرّي",
        title: "تقرير الجلسة",
        overall: "المجموع",
        narrative: "السرد السريري",
        rubric: "معايير الكفاءة",
        excerpts: "مقتطفات أساسية",
        footer: "للإدارة فقط. لا يُشارك مع المتدرّب أو أطراف خارجية.",
      }
    : {
        confidential: "Confidential assessment",
        title: "Session report",
        overall: "Overall",
        narrative: "Clinical narrative",
        rubric: "Competency rubric",
        excerpts: "Key excerpts",
        footer: "Admin-only. Not shared with the trainee or external parties.",
      };

  return (
    <article
      className="space-y-6"
      dir={isAr ? "rtl" : "ltr"}
      lang={language}
      data-report-language={language}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
            {labels.confidential}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
            {labels.title}
          </h1>
        </div>
        <div className="clinical-card px-5 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.overall}
          </p>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {overall}
            <span className="text-base font-semibold text-[var(--on-surface-variant)]">
              {tCommon("outOf100")}
            </span>
          </p>
        </div>
      </div>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {labels.narrative}
        </h2>
        <p className="text-base leading-7 text-[var(--on-surface)]">
          {report.narrative}
        </p>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.rubric}
          </h2>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {items.map((item) => {
            const pct = item.max ? Math.round((item.score / item.max) * 100) : 0;
            return (
              <li key={item.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-[var(--on-surface)]">
                    {item.label}
                  </p>
                  <p className="font-mono text-sm text-[var(--primary)]">
                    {item.score}/{item.max}
                    <span className="ms-2 text-[var(--on-surface-variant)]">
                      w{item.weight}
                    </span>
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  {item.feedback}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {report.excerpts?.length > 0 && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.excerpts}
          </h2>
          <ul className="space-y-3">
            {report.excerpts.map((ex, i) => (
              <li
                key={`${i}-${ex.slice(0, 12)}`}
                className="border-s-2 border-[var(--primary)] ps-3 text-sm italic text-[var(--on-surface)]"
              >
                {ex}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-[var(--on-surface-variant)]">{labels.footer}</p>
    </article>
  );
}
