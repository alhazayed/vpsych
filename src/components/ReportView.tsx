import { getTranslations } from "next-intl/server";
import type { SessionReport } from "@/lib/types";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import type { EvidenceLevel, EvidenceReason, ScoreEvidence } from "@/lib/session-practice";

const EVIDENCE_COPY: Record<
  "en" | "ar",
  {
    heading: string;
    note: string;
    level: Record<EvidenceLevel, string>;
    reason: Record<EvidenceReason, string>;
  }
> = {
  en: {
    heading: "Evidence",
    note: "Evidence labels say how much of the transcript backs each score, not whether the score is right. Scores are not validated.",
    level: { limited: "Limited evidence", some: "Some evidence", strong: "Strong evidence" },
    reason: {
      keyword_estimate: "Keyword estimate, not an examiner reading",
      few_turns: "Too few therapist turns to judge",
      no_observed_behaviour: "The behaviour this item looks for was not seen in the transcript",
      observed_behaviour: "Matching behaviour seen in the transcript",
      examiner_judgement: "Examiner judgement only; no transcript check for this item",
    },
  },
  ar: {
    heading: "الأدلة",
    note: "تبيّن تسميات الأدلة مقدار ما يدعم كل درجة من نص الجلسة، لا صحة الدرجة. الدرجات غير مُتحقَّق من صدقها.",
    level: { limited: "أدلة محدودة", some: "أدلة متوسطة", strong: "أدلة قوية" },
    reason: {
      keyword_estimate: "تقدير بالكلمات المفتاحية، لا قراءة مُقيِّم",
      few_turns: "عدد مداخلات المعالج قليل جدًا للحكم",
      no_observed_behaviour: "لم يظهر في النص السلوك الذي يقيسه هذا البند",
      observed_behaviour: "ظهر في النص سلوك مطابق",
      examiner_judgement: "حكم المُقيِّم فقط؛ لا فحص نصي لهذا البند",
    },
  },
};

const EVIDENCE_TONE: Record<EvidenceLevel, string> = {
  limited: "border-[var(--outline-variant)] text-[var(--on-surface-variant)]",
  some: "border-[var(--primary)] text-[var(--primary)]",
  strong: "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]",
};

export async function ReportView({
  report,
  evidence,
}: {
  report: SessionReport;
  /** Optional per-item evidence labels (admin / supervisor views). */
  evidence?: ScoreEvidence[];
}) {
  const tCommon = await getTranslations("common");
  const items = report.scores?.items ?? [];
  const overall = report.scores?.overall ?? 0;
  const language = normalizeReportLanguage(report.language);
  const isAr = language === "ar";
  const evidenceCopy = EVIDENCE_COPY[isAr ? "ar" : "en"];
  const evidenceById = new Map((evidence ?? []).map((e) => [e.item_id, e]));

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
        {evidenceById.size > 0 && (
          <p className="border-b border-[var(--outline-variant)] px-5 py-2 text-xs text-[var(--on-surface-variant)]">
            {evidenceCopy.note}
          </p>
        )}
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
                {(() => {
                  const ev = evidenceById.get(item.id);
                  if (!ev) return null;
                  return (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-semibold ${EVIDENCE_TONE[ev.level]}`}
                        data-evidence-level={ev.level}
                      >
                        {evidenceCopy.level[ev.level]}
                      </span>
                      <span className="text-[var(--on-surface-variant)]">
                        {evidenceCopy.reason[ev.reason]}
                      </span>
                    </p>
                  );
                })()}
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
