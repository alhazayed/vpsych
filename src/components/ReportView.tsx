import { getTranslations } from "next-intl/server";
import type { SessionReport } from "@/lib/types";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import type { ClinicalEducatorReport } from "@/lib/clinical-educator";

export async function ReportView({ report }: { report: SessionReport }) {
  const tCommon = await getTranslations("common");
  const items = report.scores?.items ?? [];
  const overall = report.scores?.overall ?? 0;
  const educator = report.scores?.clinical_educator as
    | ClinicalEducatorReport
    | undefined;
  const language = normalizeReportLanguage(
    report.language ?? educator?.language,
  );
  const isAr = language === "ar";

  const labels = isAr
    ? {
        confidential: "تقييم سرّي",
        title: "تقرير المعلّم السريري",
        composite: "مركب مرجعي",
        narrative: "السرد التعليمي",
        dimensions: "أبعاد الكفاءة",
        excerpts: "مقتطفات أساسية",
        examples: "أمثلة من النص",
        strengths: "نقاط القوة",
        growth: "مجالات النمو",
        practice: "تمرين مقترح",
        footer: "للإدارة فقط. لا يُشارك مع المتدرّب أو أطراف خارجية.",
        disclaimer:
          "درجات تكوينية للتدريب فقط — ليست اعتماداً عالي المخاطر.",
        pdf: "تصدير PDF",
      }
    : {
        confidential: "Confidential assessment",
        title: "Clinical Educator report",
        composite: "Reference composite",
        narrative: "Educational narrative",
        dimensions: "Competency dimensions",
        excerpts: "Key excerpts",
        examples: "Transcript examples",
        strengths: "Strengths",
        growth: "Growth areas",
        practice: "Next practice",
        footer: "Admin-only. Not shared with the trainee or external parties.",
        disclaimer:
          "Formative training signals only — not validated high-stakes credentials.",
        pdf: "Export PDF",
      };

  const dimensions =
    educator?.dimensions?.length
      ? educator.dimensions
      : items.map((item) => ({
          id: item.id,
          label: item.label,
          score: item.score,
          max: item.max,
          weight: item.weight,
          percent: item.max ? Math.round((item.score / item.max) * 100) : 0,
          feedback: item.feedback,
          strengths: [] as string[],
          growth_areas: [] as string[],
          next_practice: "",
          examples: item.examples ?? [],
        }));

  const summary =
    educator?.educational_summary?.trim() || report.narrative;

  return (
    <article
      className="space-y-6"
      dir={isAr ? "rtl" : "ltr"}
      lang={language}
      data-report-language={language}
      data-clinical-educator={educator ? "true" : "false"}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
            {labels.confidential}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
            {labels.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--on-surface-variant)]">
            {labels.disclaimer}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a
            href={`/api/admin/clinical-educator?format=pdf&sessionId=${encodeURIComponent(report.session_id)}`}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--surface-container-low)]"
          >
            {labels.pdf}
          </a>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.composite}
            <span className="ms-2 font-mono text-sm font-semibold normal-case tracking-normal text-[var(--on-surface-variant)]">
              {educator?.composite ?? overall}
              {tCommon("outOf100")}
            </span>
          </p>
        </div>
      </div>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {labels.narrative}
        </h2>
        <p className="text-base leading-7 text-[var(--on-surface)]">{summary}</p>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.dimensions}
          </h2>
        </div>
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {dimensions.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-[var(--on-surface)]">
                  {item.label}
                </p>
                <p className="font-mono text-sm text-[var(--primary)]">
                  {item.score}/{item.max}
                  <span className="ms-2 text-[var(--on-surface-variant)]">
                    {item.percent}%
                  </span>
                </p>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.min(100, item.percent)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                {item.feedback}
              </p>
              {item.strengths?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                    {labels.strengths}
                  </p>
                  <ul className="mt-1 list-disc ps-5 text-sm text-[var(--on-surface)]">
                    {item.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.growth_areas?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                    {labels.growth}
                  </p>
                  <ul className="mt-1 list-disc ps-5 text-sm text-[var(--on-surface)]">
                    {item.growth_areas.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.next_practice ? (
                <p className="mt-2 text-sm text-[var(--on-surface)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                    {labels.practice}:{" "}
                  </span>
                  {item.next_practice}
                </p>
              ) : null}
              {item.examples?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                    {labels.examples}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {item.examples.map((ex, i) => (
                      <li
                        key={`${item.id}-ex-${i}`}
                        className="border-s-2 border-[var(--primary)] ps-3 text-sm italic text-[var(--on-surface)]"
                      >
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(educator?.coaching_excerpts?.length || report.excerpts?.length) > 0 && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {labels.excerpts}
          </h2>
          <ul className="space-y-3">
            {(educator?.coaching_excerpts?.length
              ? educator.coaching_excerpts
              : report.excerpts
            ).map((ex, i) => (
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
