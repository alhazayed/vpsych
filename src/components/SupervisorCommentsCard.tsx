import { getLocale, getTranslations } from "next-intl/server";
import type { TraineeReviewComment } from "@/lib/supervisor-reviews/trainee-comments";

/**
 * Trainee view: what their supervisor wrote about a practice session. Words
 * only: adjusted scores and flags stay with supervisors and admins.
 */
export async function SupervisorCommentsCard({
  comments,
}: {
  comments: TraineeReviewComment[];
}) {
  if (comments.length === 0) return null;
  const t = await getTranslations("sessions.complete.supervisorComments");
  const locale = await getLocale();
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
  });

  return (
    <section
      className="clinical-card mb-4 p-5 fade-in-up"
      aria-labelledby="supervisor-comments-title"
      data-supervisor-comments
    >
      <h2
        id="supervisor-comments-title"
        className="flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold"
      >
        <span aria-hidden className="material-symbols-outlined text-[20px] text-[var(--primary)]">
          forum
        </span>
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
      <ul className="mt-4 space-y-4">
        {comments.map((c, i) => (
          <li key={i} className="border-s-2 border-[var(--primary)] ps-3">
            <p className="whitespace-pre-wrap text-sm text-[var(--on-surface)]" dir="auto">
              {c.comment}
            </p>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              {t("byline", {
                name: c.reviewerName ?? t("supervisor"),
                date: dateFmt.format(new Date(c.updatedAt)),
              })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
