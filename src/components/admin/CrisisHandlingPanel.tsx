import { getTranslations } from "next-intl/server";
import type { CrisisHandling } from "@/lib/session-practice";

/** Admin/supervisor: what the trainee did after a suicide-risk disclosure (WHO mhGAP steps). */
export async function CrisisHandlingPanel({ crisis }: { crisis: CrisisHandling | null }) {
  const t = await getTranslations("admin.reportDetail.crisis");

  return (
    <section className="clinical-card space-y-4 p-5" aria-labelledby="crisis-handling-title">
      <div>
        <h2
          id="crisis-handling-title"
          className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
      </div>

      {!crisis ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("noDisclosure")}</p>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--outline-variant)] p-3 text-sm">
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">
              {t("disclosure", { turn: crisis.disclosure_turn + 1 })}
            </p>
            <p className="mt-1 text-[var(--on-surface)]" dir="auto">
              “{crisis.disclosure_excerpt}”
            </p>
            <p className="mt-2 text-[var(--on-surface)]">
              {crisis.turns_to_respond === null
                ? t("noResponse")
                : crisis.turns_to_respond === 0
                  ? t("respondedNext")
                  : t("respondedAfter", { n: crisis.turns_to_respond })}
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            {crisis.steps.map((step) => (
              <li key={step.id} className="flex gap-2">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    step.detected ? "text-[var(--primary)]" : "text-[var(--error)]"
                  }`}
                  aria-hidden
                >
                  {step.detected ? "check_circle" : "cancel"}
                </span>
                <div>
                  <p className="font-medium text-[var(--on-surface)]">
                    {t(`steps.${step.id}`)}
                    <span className="sr-only">
                      {" "}
                      {step.detected ? t("done") : t("notSeen")}
                    </span>
                  </p>
                  {step.id === "stayed_engaged" ? (
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {t("turnsAfter", { n: crisis.therapist_turns_after })}
                    </p>
                  ) : step.excerpt ? (
                    <p className="text-xs text-[var(--on-surface-variant)]" dir="auto">
                      “{step.excerpt}”
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-[var(--on-surface-variant)]">{t("limitation")}</p>
    </section>
  );
}
