import { getTranslations } from "next-intl/server";
import {
  LADDER_LEVELS,
  type LadderLevelKey,
  type LadderProgress,
} from "@/lib/training-ladder";

export const LEVEL_MARK: Record<LadderLevelKey, string> = {
  easy: "🟢",
  basic: "🔵",
  intermediate: "🟡",
  advanced: "🟠",
  expert: "🔴",
};

/**
 * The five levels of one patient: cleared ✓, current ●, locked 🔒.
 * `compact` renders one wrapped line for the dashboard cards.
 */
export async function LadderLevelList({
  progress,
  compact = false,
}: {
  progress: LadderProgress;
  compact?: boolean;
}) {
  const t = await getTranslations("training");
  return (
    <ol
      className={
        compact
          ? "flex flex-wrap gap-x-3 gap-y-1 text-xs"
          : "space-y-2 text-sm"
      }
    >
      {LADDER_LEVELS.map(({ level, key }) => {
        const state = progress.levels[level - 1]!.state;
        const icon = state === "cleared" ? "✓" : state === "current" ? "●" : "🔒";
        return (
          <li
            key={key}
            className={`flex items-center gap-2 ${
              state === "locked"
                ? "text-[var(--on-surface-variant)]"
                : state === "current"
                  ? "font-semibold text-[var(--primary)]"
                  : "text-[var(--on-surface)]"
            } ${compact ? "" : "rounded-lg border border-[var(--outline-variant)] px-3 py-2"}`}
          >
            <span aria-hidden>{compact ? icon : LEVEL_MARK[key]}</span>
            <span>{t(`levels.${key}`)}</span>
            {!compact ? (
              <>
                <span className="text-xs font-normal text-[var(--on-surface-variant)]">
                  {t(`levelPurpose.${key}`)}
                </span>
                <span className="ms-auto flex items-center gap-1 text-xs">
                  <span aria-hidden>{icon}</span>
                  {t(`levelState.${state}`)}
                </span>
              </>
            ) : (
              <span className="sr-only">{t(`levelState.${state}`)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
