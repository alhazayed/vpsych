"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { MAX_REVIEW_COMMENT } from "@/lib/supervisor-reviews/validation";
import { reviewErrorKey } from "@/lib/supervisor-reviews/client-errors";
import {
  citesAdjustedScore,
  commentHiddenReason,
} from "@/lib/supervisor-reviews/comment-visibility";

type Initial = {
  comment: string;
  adjustedOverall: number | null;
  flagged: boolean;
  savedAt: string;
} | null;

/** The caller's own review of one report: comment, adjusted score, flag. */
export function ReportReviewForm({
  sessionId,
  aiOverall,
  initial,
  traineeSeesComments = false,
}: {
  sessionId: string;
  aiOverall: number;
  initial: Initial;
  /** Practice session: the trainee will read this comment. */
  traineeSeesComments?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("supervisorReviews.form");
  const tErr = useTranslations("supervisorReviews.errors");
  const id = useId();
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [score, setScore] = useState(
    initial?.adjustedOverall === null || initial?.adjustedOverall === undefined
      ? ""
      : String(initial.adjustedOverall),
  );
  const [flagged, setFlagged] = useState(initial?.flagged ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Tell the supervisor before saving when the trainee would not see it.
  const scoreTyped = /^\d{1,3}$/.test(score.trim()) ? Number(score.trim()) : null;
  const hiddenFromTrainee =
    traineeSeesComments && comment.trim() !== ""
      ? commentHiddenReason(comment, {
          citesReviewNumber: scoreTyped !== null && citesAdjustedScore(comment, scoreTyped),
        })
      : null;

  async function send(method: "PUT" | "DELETE") {
    if (method === "DELETE" && !window.confirm(t("removeConfirm"))) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    const trimmed = score.trim();
    // Sent as typed: the server rejects anything but a whole number 0–100.
    const adjustedOverall = trimmed === "" ? null : Number(trimmed);
    try {
      const res = await fetch(`/api/supervise/reviews/${sessionId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body:
          method === "PUT"
            ? JSON.stringify({
                comment,
                adjustedOverall: Number.isNaN(adjustedOverall) ? trimmed : adjustedOverall,
                flagged,
              })
            : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setError(tErr(reviewErrorKey(res.status, data.code)));
        setBusy(false);
        return;
      }
      if (method === "DELETE") {
        setComment("");
        setScore("");
        setFlagged(false);
      }
      setStatus(method === "PUT" ? t("saved") : t("removed"));
      setBusy(false);
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4 border-t border-[var(--outline-variant)] pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send("PUT");
      }}
    >
      <h3 className="text-sm font-semibold">{t("yourReview")}</h3>
      <div>
        <label htmlFor={`${id}-comment`} className="block text-sm font-medium">
          {t("comment")}
        </label>
        <textarea
          id={`${id}-comment`}
          className="field-input mt-1"
          rows={5}
          dir="auto"
          maxLength={MAX_REVIEW_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-describedby={`${id}-comment-hint`}
        />
        <p id={`${id}-comment-hint`} className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {t("commentHint")}
          {traineeSeesComments ? ` ${t("traineeSees")}` : ""}
        </p>
        {hiddenFromTrainee === "score" && (
          <p role="status" className="mt-1 text-xs font-medium text-[var(--error)]">
            {t("hiddenScore")}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-score`} className="block text-sm font-medium">
          {t("adjusted")}
        </label>
        <input
          id={`${id}-score`}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          dir="ltr"
          className="field-input mt-1 max-w-32"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          aria-describedby={`${id}-score-hint`}
        />
        <p id={`${id}-score-hint`} className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {t("adjustedHint", { score: aiOverall })}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={flagged}
          onChange={(e) => setFlagged(e.target.checked)}
        />
        {t("flag")}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? t("saving") : t("save")}
        </button>
        {initial && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void send("DELETE")}
          >
            {t("remove")}
          </button>
        )}
        {status && (
          <span role="status" className="text-sm text-[var(--on-surface-variant)]">
            {status}
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-[var(--error)]">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
