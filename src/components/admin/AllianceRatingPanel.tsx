import { getTranslations } from "next-intl/server";
import type { AllianceRating } from "@/lib/session-practice";

const DIMENSIONS = ["relationship", "goals_topics", "approach", "overall"] as const;

/** Admin-only: how the session felt to the virtual patient (SRS-style, simulated). */
export async function AllianceRatingPanel({ rating }: { rating: AllianceRating | null }) {
  const t = await getTranslations("admin.reportDetail.alliance");

  return (
    <section className="clinical-card space-y-4 p-5" aria-labelledby="alliance-rating-title">
      <div>
        <h2
          id="alliance-rating-title"
          className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
      </div>

      {!rating ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("unavailable")}</p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DIMENSIONS.map((d) => (
              <li key={d} className="rounded-lg border border-[var(--outline-variant)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--on-surface)]">
                    {t(`dimensions.${d}`)}
                  </span>
                  <span className="font-mono text-sm text-[var(--primary)]">
                    {t("outOf10", { value: rating[d] })}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, rating[d] * 10)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--on-surface)]">
            {t("total", { value: rating.total, turns: rating.turns })}
          </p>

          <div>
            <h3 className="text-sm font-semibold text-[var(--on-surface)]">
              {t("rupturesTitle")}
            </h3>
            {rating.ruptures.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("noRuptures")}</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {rating.ruptures.map((r) => (
                  <li key={r.turn_index} className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[var(--on-surface)]">
                      {t("rupture", {
                        turn: r.turn_index + 1,
                        before: r.trust_before,
                        after: r.trust_after,
                      })}
                    </span>
                    <span
                      className={
                        r.repaired
                          ? "text-xs font-semibold text-[var(--primary)]"
                          : "text-xs font-semibold text-[var(--error)]"
                      }
                    >
                      {r.repaired
                        ? t("repaired", { turn: (r.repaired_turn_index ?? 0) + 1 })
                        : t("notRepaired")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-[var(--on-surface-variant)]">{t("limitation")}</p>
    </section>
  );
}
