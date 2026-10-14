import { getTranslations } from "next-intl/server";

// Landing hero: a session record drawn in the Case file look (folder tabs,
// referral notes, time-stamped lines, the patient's latest line highlighted).
// Built from text, not a picture, so it follows the UI language. The lines are
// Maya's authored sample utterances; no diagnosis is shown.
export async function CaseFileSample() {
  const t = await getTranslations("landing.hero");
  const tabs = [t("sample.tabs.first"), t("sample.tabs.second"), t("sample.tabs.third")];

  return (
    <figure role="img" aria-label={t("imageAlt")} className="m-0">
      <div aria-hidden className="select-none">
        <div className="flex items-end gap-1 overflow-hidden ps-3">
          {tabs.map((tab, i) => (
            <span key={tab} className={`cf-tab ${i === 0 ? "cf-tab--open" : ""}`}>
              {tab}
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg rounded-ss-none border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_10px_30px_rgba(27,42,65,0.08)]">
          <div className="grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
            <div className="space-y-4 border-b border-[var(--outline-variant)] p-5 sm:border-b-0 sm:border-e">
              <div>
                <p className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                  {t("sample.name")}
                </p>
                <p className="mt-1 text-xs text-[var(--outline)]">{t("sample.meta")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--outline)]">
                  {t("sample.referralTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
                  {t("sample.referral")}
                </p>
              </div>
            </div>
            <div className="px-5 py-2 text-sm">
              <div className="grid grid-cols-[3rem_4rem_minmax(0,1fr)] gap-2 border-b border-[var(--outline-variant)] py-3">
                <span className="text-xs tabular-nums text-[var(--outline)]">{t("sample.time1")}</span>
                <span className="text-xs font-semibold text-[var(--outline)]">{t("sample.you")}</span>
                <span className="text-[var(--on-surface)]">{t("sample.question")}</span>
              </div>
              <div className="grid grid-cols-[3rem_4rem_minmax(0,1fr)] gap-2 py-3">
                <span className="text-xs tabular-nums text-[var(--outline)]">{t("sample.time2")}</span>
                <span className="text-xs font-semibold text-[var(--primary)]">{t("sample.patient")}</span>
                <span className="leading-6 text-[var(--on-surface)]">
                  <span className="cf-mark">{t("sample.answer")}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--outline-variant)] px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            <span className="grow text-xs text-[var(--on-surface-variant)]">
              {t("sample.status")} · <span className="tabular-nums">{t("sample.timer")}</span>
            </span>
            <span className="rounded bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)]">
              {t("sample.end")}
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
