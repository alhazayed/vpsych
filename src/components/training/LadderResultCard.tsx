import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LADDER_ATTEMPT_COLUMNS,
  LADDER_LEVEL_COUNT,
  attemptOutcome,
  findLadderPatient,
  isLadderLevel,
  ladderLevelDef,
  normalizeLadderAttempt,
  type LadderLevel,
} from "@/lib/training-ladder";

/**
 * Post-session ladder result: level cleared (and what unlocked), not cleared
 * (with the pass mark), or still scoring. Renders nothing for sessions that
 * are not ladder attempts. The result was decided by the database when the
 * report was written. The page's main button leads back to the patient.
 */
export async function LadderResultCard({
  supabase,
  sessionId,
  patientName,
}: {
  supabase: SupabaseClient;
  sessionId: string;
  patientName: string;
}) {
  const { data, error } = await supabase
    .from("training_ladder_attempts")
    .select(LADDER_ATTEMPT_COLUMNS)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  const attempt = normalizeLadderAttempt(
    data as unknown as Parameters<typeof normalizeLadderAttempt>[0],
  );
  const patient = findLadderPatient(attempt.patient_key);
  if (!patient || !isLadderLevel(attempt.level)) return null;
  const t = await getTranslations("training");
  const level = attempt.level as LadderLevel;
  const levelName = t(`levels.${ladderLevelDef(level).key}`);
  const outcome = attemptOutcome(attempt);

  if (outcome === "passed") {
    const next =
      level < LADDER_LEVEL_COUNT
        ? t(`levels.${ladderLevelDef((level + 1) as LadderLevel).key}`)
        : null;
    return (
      <section className="clinical-card mb-4 p-5 fade-in-up" aria-live="polite">
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          ✅ {t("result.clearedTitle")}
        </h2>
        <p className="mt-2 text-sm">
          {t("result.clearedBody", { name: patientName, level: levelName })}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {t("result.scoreLine", { score: attempt.score ?? 0 })}
        </p>
        {next ? (
          <>
            <p className="mt-2 text-sm font-semibold">
              {t("result.nextUnlocked", { level: next })}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("result.nextComplexity")}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm">{t("result.completedBody")}</p>
        )}
      </section>
    );
  }

  if (outcome === "failed") {
    return (
      <section className="clinical-card mb-4 p-5 fade-in-up" aria-live="polite">
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          ❌ {t("result.notClearedTitle")}
        </h2>
        <p className="mt-2 text-sm font-semibold">
          {t("result.scoreLine", { score: attempt.score ?? 0 })}
        </p>
        <p className="text-sm">{t("result.required")}</p>
        <p className="mt-2 text-sm">{t("result.remains", { level: levelName })}</p>
        <p className="text-sm text-[var(--on-surface-variant)]">{t("result.retry")}</p>
      </section>
    );
  }

  if (outcome === "too_short") {
    return (
      <section className="clinical-card mb-4 p-5 fade-in-up" aria-live="polite" data-ladder-too-short>
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {t("result.tooShortTitle")}
        </h2>
        <p className="mt-2 text-sm">{t("result.tooShortBody", { level: levelName })}</p>
        <p className="text-sm text-[var(--on-surface-variant)]">{t("result.tooShortMic")}</p>
      </section>
    );
  }

  return (
    <section className="clinical-card mb-4 p-5 fade-in-up" aria-live="polite">
      <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
        {t("result.scoringTitle")}
      </h2>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        {t("result.scoringBody")}
      </p>
    </section>
  );
}
