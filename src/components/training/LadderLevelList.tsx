import { getTranslations } from "next-intl/server";
import {
  LADDER_LEVELS,
  type LadderProgress,
} from "@/lib/training-ladder";

/**
 * The five levels of one patient as numbered Case file boxes: cleared filled,
 * current outlined in oxblood, locked plain. `compact` renders the five boxes
 * in one row for the dashboard; the full list adds each level's name, purpose
 * and state.
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
    <ol className={compact ? "flex gap-1" : "space-y-2 text-sm"}>
      {LADDER_LEVELS.map(({ level, key }) => {
        const state = progress.levels[level - 1]!.state;
        const box = (
          <span aria-hidden className={`cf-level cf-level--${state}`}>
            {level}
          </span>
        );
        if (compact) {
          return (
            <li key={key} title={`${t(`levels.${key}`)}: ${t(`levelState.${state}`)}`}>
              {box}
              <span className="sr-only">
                {t(`levels.${key}`)}: {t(`levelState.${state}`)}
              </span>
            </li>
          );
        }
        return (
          <li
            key={key}
            className={`flex items-center gap-3 rounded-lg border border-[var(--outline-variant)] px-3 py-2 ${
              state === "locked"
                ? "text-[var(--on-surface-variant)]"
                : state === "current"
                  ? "font-semibold text-[var(--primary)]"
                  : "text-[var(--on-surface)]"
            }`}
          >
            {box}
            <span>{t(`levels.${key}`)}</span>
            <span className="text-xs font-normal text-[var(--on-surface-variant)]">
              {t(`levelPurpose.${key}`)}
            </span>
            <span className="ms-auto text-xs">{t(`levelState.${state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
