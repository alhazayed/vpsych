import { getLocale, getTranslations } from "next-intl/server";
import type { SessionReport } from "@/lib/types";
import { localizeRubricLabel, normalizeReportLanguage } from "@/lib/ai/report-locale";
import { isAppLocale, localeDirection } from "@/i18n/config";
import type { EvidenceLevel, ScoreEvidence } from "@/lib/session-practice";
import {
  storedEvidence,
  storedUnscored,
  unscoredLeftOutOfOverall,
} from "@/lib/ai/assessment-evidence";

const EVIDENCE_TONE: Record<EvidenceLevel, string> = {
  limited: "border-[var(--outline-variant)] text-[var(--on-surface-variant)]",
  some: "border-[var(--primary)] text-[var(--primary)]",
  strong: "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]",
};

export async function ReportView({
  report,
  evidence,
  audience = "admin",
}: {
  report: SessionReport;
  /** Optional per-item evidence labels (admin / supervisor views). */
  evidence?: ScoreEvidence[];
  /** Who reads this page; sets the privacy note at the foot. */
  audience?: "admin" | "supervisor";
}) {
  const tCommon = await getTranslations("common");
  const t = await getTranslations("report");
  // Chrome follows the page locale; the narrative, rationales and excerpts are
  // stored report content in the session's language and render as written.
  const rawLocale = await getLocale();
  const uiLocale = isAppLocale(rawLocale) ? rawLocale : "en";
  const items = report.scores?.items ?? [];
  const overall = report.scores?.overall ?? 0;
  const language = normalizeReportLanguage(report.language);
  const contentDir = language === "ar" ? "rtl" : "ltr";
  const evidenceById = new Map((evidence ?? []).map((e) => [e.item_id, e]));
  const unscored = storedUnscored(report.scores?.unscored_items);
  const unscoredLeftOut = unscoredLeftOutOfOverall(items, unscored);

  return (
    <article
      className="space-y-6"
      dir={localeDirection(uiLocale)}
      lang={uiLocale}
      data-report-language={language}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
            {t("confidential")}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
            {t("title")}
          </h1>
        </div>
        <div className="clinical-card px-5 py-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {t("overall")}
          </p>
          <p className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
            {overall}
            <span className="text-base font-semibold text-[var(--on-surface-variant)]">
              {tCommon("outOf100")}
            </span>
          </p>
        </div>
      </div>

      {unscored.length > 0 && (
        <p
          className="clinical-card border-s-4 border-[var(--outline)] px-5 py-3 text-sm text-[var(--on-surface)]"
          data-unscored-rule={unscoredLeftOut ? "left_out" : "counted_zero"}
        >
          {unscoredLeftOut
            ? t("unscored.leftOut", { count: unscored.length })
            : t("unscored.countedZero")}
        </p>
      )}

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {t("narrative")}
        </h2>
        <p
          className="text-base leading-7 text-[var(--on-surface)]"
          lang={language}
          dir={contentDir}
        >
          {report.narrative}
        </p>
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-5 py-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {t("rubric")}
          </h2>
        </div>
        {evidenceById.size > 0 && (
          <p className="border-b border-[var(--outline-variant)] px-5 py-2 text-xs text-[var(--on-surface-variant)]">
            {t("evidence.note")}
          </p>
        )}
        <ul className="divide-y divide-[var(--surface-container-low)]">
          {items.map((item) => {
            const pct = item.max ? Math.round((item.score / item.max) * 100) : 0;
            return (
              <li key={item.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-[var(--on-surface)]">
                    {localizeRubricLabel(item.id, item.label, uiLocale)}
                  </p>
                  <p className="font-mono text-sm text-[var(--primary)]">
                    {item.score}/{item.max}
                    <span className="ms-2 text-[var(--on-surface-variant)]">
                      {t("weight", { weight: item.weight })}
                    </span>
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p
                  className="mt-2 text-sm text-[var(--on-surface-variant)]"
                  lang={language}
                  dir={contentDir}
                >
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
                        {t(`evidence.level.${ev.level}`)}
                      </span>
                      <span className="text-[var(--on-surface-variant)]">
                        {t(`evidence.reason.${ev.reason}`)}
                      </span>
                    </p>
                  );
                })()}
                {(() => {
                  // Absent on older and heuristic reports: show nothing then.
                  if (!Array.isArray(item.evidence)) return null;
                  const quotes = storedEvidence(item.evidence);
                  if (quotes.length === 0) {
                    return (
                      <p className="mt-2 text-xs text-[var(--on-surface-variant)]" data-quotes="none">
                        {t("quotes.none")}
                      </p>
                    );
                  }
                  return (
                    <ul className="mt-3 space-y-2" aria-label={t("quotes.label")}>
                      {quotes.map((q) => (
                        <li
                          key={`${q.turn}-${q.quote.slice(0, 16)}`}
                          className="border-s-2 border-[var(--outline-variant)] ps-3 text-sm"
                        >
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                            {t("quotes.turn", {
                              turn: q.turn,
                              speaker: t(`quotes.speaker.${q.speaker}`),
                            })}
                          </span>
                          <q className="text-[var(--on-surface)]" lang={language} dir="auto">
                            {q.quote}
                          </q>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </li>
            );
          })}
        </ul>
        {unscored.length > 0 && (
          <div className="border-t border-[var(--outline-variant)]">
            <h3 className="bg-[var(--surface-bright)] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              {t("unscored.title")}
            </h3>
            <ul className="divide-y divide-[var(--surface-container-low)]">
              {unscored.map((u) => (
                <li key={u.id} className="px-5 py-4" data-unscored-item={u.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-medium text-[var(--on-surface)]">
                      {localizeRubricLabel(u.id, u.label, uiLocale)}
                    </p>
                    <p className="flex items-center gap-2 text-sm">
                      <span className="rounded-full border border-[var(--outline)] px-2 py-0.5 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {t("unscored.badge")}
                      </span>
                      <span className="text-[var(--on-surface-variant)]">
                        {t("weight", { weight: u.weight })}
                      </span>
                    </p>
                  </div>
                  {u.reason ? (
                    <p
                      className="mt-2 text-sm text-[var(--on-surface-variant)]"
                      lang={language}
                      dir={contentDir}
                    >
                      {u.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report.excerpts?.length > 0 && (
        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
            {t("excerpts")}
          </h2>
          <ul className="space-y-3" lang={language} dir={contentDir}>
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

      <p className="text-xs text-[var(--on-surface-variant)]">{t(audience === "supervisor" ? "supervisorOnlyNote" : "adminOnlyNote")}</p>
    </article>
  );
}
