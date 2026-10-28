import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { PracticeFocus } from "@/lib/sessions/practice-focus";

/**
 * "Your focus for this session": the "Try next time" items from the trainee's
 * latest practice session, shown again before the next one. Words only, as on
 * the complete page; renders nothing when there is no focus.
 */
export async function PracticeFocusCard({
  focus,
  className = "",
}: {
  focus: PracticeFocus | null;
  className?: string;
}) {
  if (!focus) return null;
  const t = await getTranslations("sessions.focus");
  const locale = await getLocale();
  const date = focus.endedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { dateStyle: "medium" }).format(
        new Date(focus.endedAt),
      )
    : null;

  return (
    <section
      className={`clinical-card border-s-4 border-[var(--primary)] p-5 ${className}`}
      aria-labelledby="practice-focus-title"
      data-practice-focus
    >
      <h2
        id="practice-focus-title"
        className="flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold"
      >
        <span aria-hidden className="material-symbols-outlined text-[20px] text-[var(--primary)]">
          target
        </span>
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        {date ? t("subtitle", { date }) : t("subtitleNoDate")}
      </p>
      <ul
        className="mt-3 list-disc space-y-1.5 ps-6 text-sm text-[var(--on-surface)]"
        lang={focus.language}
        dir={focus.language === "ar" ? "rtl" : "ltr"}
      >
        {focus.nextSteps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
      <Link
        href={`/sessions/${focus.sessionId}/complete`}
        className="mt-3 inline-flex text-sm font-medium text-[var(--primary)] hover:underline"
      >
        {t("open")}
      </Link>
    </section>
  );
}
