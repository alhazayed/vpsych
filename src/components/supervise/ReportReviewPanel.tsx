import { getLocale, getTranslations } from "next-intl/server";
import type { ReviewWithAuthor } from "@/lib/supervisor-reviews";
import { ReportReviewForm } from "./ReportReviewForm";

/**
 * Supervisor reviews of one report, shown beside the AI report. The AI score
 * is never changed: an adjusted score is a separate value with its author and
 * time. `currentUserId` set and `canEdit` true shows the caller's own form.
 */
export async function ReportReviewPanel({
  sessionId,
  aiOverall,
  reviews,
  loadFailed,
  currentUserId,
  canEdit,
  traineeSeesComments = false,
}: {
  sessionId: string;
  aiOverall: number;
  reviews: ReviewWithAuthor[];
  loadFailed: boolean;
  currentUserId: string | null;
  canEdit: boolean;
  /** Practice session: the trainee reads the comments (no scores or flags). */
  traineeSeesComments?: boolean;
}) {
  const t = await getTranslations("supervisorReviews.panel");
  const locale = await getLocale();
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const mine = currentUserId
    ? reviews.find((r) => r.reviewer_id === currentUserId) ?? null
    : null;
  const others = reviews.filter((r) => r !== mine);

  function author(r: ReviewWithAuthor): string {
    if (r.reviewer_id && r.reviewer_id === currentUserId) return t("you");
    if (!r.reviewer_id) return t("deletedAccount");
    return r.reviewer?.display_name ?? t("anotherSupervisor");
  }

  return (
    <section
      className="clinical-card space-y-4 p-5"
      aria-labelledby={`review-${sessionId}`}
    >
      <div>
        <h2
          id={`review-${sessionId}`}
          className="font-[family-name:var(--font-headline)] text-lg font-semibold"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>
        <p className="mt-2 text-sm font-semibold">{t("aiScore", { score: aiOverall })}</p>
      </div>

      {loadFailed ? (
        <p role="alert" className="text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : (
        <>
          {(canEdit ? others : reviews).length > 0 ? (
            <div className="space-y-3">
              {canEdit && (
                <h3 className="text-sm font-semibold">{t("others")}</h3>
              )}
              <ul className="space-y-3">
                {(canEdit ? others : reviews).map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg bg-[var(--surface-container-high)] p-3 text-sm"
                    data-review-id={r.id}
                  >
                    <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                      <span className="font-semibold text-[var(--on-surface)]">
                        {t("byline", {
                          name: author(r),
                          date: dateFmt.format(new Date(r.created_at)),
                        })}
                      </span>
                      {r.updated_at !== r.created_at && (
                        <span>{t("edited", { date: dateFmt.format(new Date(r.updated_at)) })}</span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {r.adjusted_overall !== null && (
                        <span className="status-chip status-chip-active" data-adjusted-overall={r.adjusted_overall}>
                          {t("adjusted", { score: r.adjusted_overall })}
                        </span>
                      )}
                      {r.flagged && <span className="status-chip">{t("flagged")}</span>}
                    </div>
                    {r.comment && (
                      <p className="mt-2 whitespace-pre-wrap" dir="auto">
                        {r.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            !canEdit && (
              <p className="text-sm text-[var(--on-surface-variant)]">{t("none")}</p>
            )
          )}
          {canEdit && (
            <ReportReviewForm
              sessionId={sessionId}
              aiOverall={aiOverall}
              traineeSeesComments={traineeSeesComments}
              initial={
                mine
                  ? {
                      comment: mine.comment ?? "",
                      adjustedOverall: mine.adjusted_overall,
                      flagged: mine.flagged,
                      savedAt: mine.updated_at,
                    }
                  : null
              }
            />
          )}
        </>
      )}
    </section>
  );
}
