import { getTranslations } from "next-intl/server";
import type { TraineeFeedbackView } from "@/lib/sessions/trainee-feedback";
import type { TraineeFeedback } from "@/lib/types";

const SECTIONS: ReadonlyArray<{
  key: keyof TraineeFeedback;
  icon: string;
  tone: string;
}> = [
  { key: "strengths", icon: "thumb_up", tone: "text-emerald-700" },
  { key: "missed", icon: "error", tone: "text-[var(--error)]" },
  { key: "next_steps", icon: "arrow_forward", tone: "text-[var(--primary)]" },
];

/**
 * Trainee view: the examiner's words on a practice session (what went well,
 * what was missed, what to try next). No scores, items or narrative; the
 * performance report stays admin-only. Never rendered for skill tests.
 */
export async function TraineeSessionFeedback({
  view,
  language,
}: {
  view: TraineeFeedbackView;
  /** Language the report was written in (the session's language). */
  language: "en" | "ar";
}) {
  if (view.kind === "none") return null;
  const t = await getTranslations("sessions.complete.feedback");

  return (
    <section
      className="clinical-card mb-4 p-5 fade-in-up"
      aria-labelledby="trainee-feedback-title"
    >
      <h2
        id="trainee-feedback-title"
        className="font-[family-name:var(--font-headline)] text-lg font-semibold"
      >
        {t("title")}
      </h2>
      {view.kind === "unavailable" ? (
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {t("unavailable")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {t("subtitle")}
          </p>
          <div className="mt-4 space-y-4">
            {SECTIONS.filter((s) => view.feedback[s.key].length > 0).map((s) => (
              <div key={s.key}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
                  <span
                    aria-hidden
                    className={`material-symbols-outlined text-[18px] ${s.tone}`}
                  >
                    {s.icon}
                  </span>
                  {t(s.key)}
                </h3>
                <ul
                  className="list-disc space-y-1.5 ps-8 text-sm text-[var(--on-surface)]"
                  lang={language}
                  dir={language === "ar" ? "rtl" : "ltr"}
                >
                  {view.feedback[s.key].map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
