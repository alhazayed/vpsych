import { getTranslations } from "next-intl/server";
import type {
  IndicativeCtsr,
  PracticeGroup,
  SelfReportProfile,
  SessionPracticeReport,
} from "@/lib/session-practice";
import { severityBand } from "@/lib/session-practice";

type Props = {
  practice: SessionPracticeReport;
  ctsr: IndicativeCtsr;
  selfReport: SelfReportProfile | null;
};

/** Admin-only: observable best practices, indicative CTS-R, PHQ-9/GAD-7 targets. */
export async function SessionPracticePanel({ practice, ctsr, selfReport }: Props) {
  const t = await getTranslations("admin.reportDetail.practice");

  const groups = practice.groups.filter(
    (g) => g.applicable || practice.checks.some((c) => c.group === g.group && c.detected),
  );

  return (
    <section className="clinical-card space-y-6 p-5" aria-labelledby="session-practice-title">
      <div>
        <h2
          id="session-practice-title"
          className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.group} className="rounded-lg border border-[var(--outline-variant)] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-[var(--on-surface)]">
                {t(`groups.${g.group as PracticeGroup}`)}
              </h3>
              <span className="text-xs text-[var(--on-surface-variant)]">
                {g.applicable ? t("coverage", { met: g.met, total: g.total }) : t("informational")}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {practice.checks
                .filter((c) => c.group === g.group && (c.applicable || c.detected))
                .map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        c.detected ? "text-[var(--primary)]" : "text-[var(--outline)]"
                      }`}
                      aria-hidden
                    >
                      {c.detected ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span>
                      <span className="text-[var(--on-surface)]">{t(`checks.${c.id}`)}</span>
                      <span className="sr-only">
                        {" "}
                        {c.detected ? t("detected") : t("missed")}
                      </span>
                      {c.excerpt ? (
                        <span className="block text-xs text-[var(--on-surface-variant)]" dir="auto">
                          “{c.excerpt}”
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-[var(--on-surface)]">{t("ctsr.title")}</h3>
          <span className="text-xs text-[var(--on-surface-variant)]">
            {ctsr.total !== null
              ? t("ctsr.total", { total: ctsr.total })
              : t("ctsr.partial", { rated: ctsr.rated })}
          </span>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {ctsr.items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--outline-variant)]">
                <td className="py-1.5 text-[var(--on-surface)]">{t(`ctsr.items.${item.id}`)}</td>
                <td className="py-1.5 text-end font-semibold tabular-nums text-[var(--on-surface)]">
                  {item.score === null ? "—" : `${item.score} / 6`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selfReport ? (
        <div>
          <h3 className="font-semibold text-[var(--on-surface)]">{t("selfReport.title")}</h3>
          <p className="mt-1 text-sm text-[var(--on-surface)]">
            {t("selfReport.phq9", {
              total: selfReport.phq9.total,
              band: t(`bands.${severityBand("phq9", selfReport.phq9.total)}`),
            })}
            {" · "}
            {t("selfReport.gad7", {
              total: selfReport.gad7.total,
              band: t(`bands.${severityBand("gad7", selfReport.gad7.total)}`),
            })}
          </p>
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{t("selfReport.note")}</p>
        </div>
      ) : null}

      <p className="text-xs text-[var(--on-surface-variant)]">{t("limitations")}</p>
    </section>
  );
}
