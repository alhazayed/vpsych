"use client";

import type { CaseReadinessResult, ReadinessStatus } from "@/lib/admin/virtual-patient";

const STATUS_GLYPH: Record<ReadinessStatus, string> = {
  COMPLETE: "✓",
  WARNING: "⚠",
  BLOCKED: "✕",
};

const STATUS_CLASS: Record<ReadinessStatus, string> = {
  COMPLETE: "text-[var(--primary)]",
  WARNING: "text-[var(--secondary)]",
  BLOCKED: "text-[var(--error)]",
};

function statusWord(status: ReadinessStatus, labels: CaseReadinessLabels): string {
  switch (status) {
    case "COMPLETE":
      return labels.statusComplete;
    case "WARNING":
      return labels.statusWarning;
    case "BLOCKED":
      return labels.statusBlocked;
  }
}

export type CaseReadinessLabels = {
  title: string;
  statusComplete: string;
  statusWarning: string;
  statusBlocked: string;
  readyToPublish: string;
  notReady: string;
  publishUnavailable: string;
  published: string;
  archived: string;
  nextAction: string;
  reviewReadiness: string;
  blockedCount: string;
  arabicStubNote: string;
  loading: string;
  loadFailed: string;
};

export const DEFAULT_READINESS_LABELS: CaseReadinessLabels = {
  title: "Case readiness",
  statusComplete: "Complete",
  statusWarning: "Needs attention",
  statusBlocked: "Blocked",
  readyToPublish: "Ready to publish",
  notReady: "Not ready to publish",
  publishUnavailable: "Publish unavailable",
  published: "Published",
  archived: "Archived",
  nextAction: "Next",
  reviewReadiness: "Review readiness",
  blockedCount: "{count} items need attention",
  arabicStubNote:
    "Arabic must be authored independently. English generation does not complete Arabic.",
  loading: "Checking readiness…",
  loadFailed: "Could not load readiness.",
};

export function CaseReadinessPanel({
  readiness,
  labels = DEFAULT_READINESS_LABELS,
  compact = false,
  onReview,
}: {
  readiness: CaseReadinessResult | null;
  labels?: CaseReadinessLabels;
  compact?: boolean;
  onReview?: () => void;
}) {
  if (!readiness) {
    return (
      <section
        className="clinical-card space-y-3 p-5"
        aria-busy="true"
        aria-live="polite"
      >
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {labels.title}
        </h2>
        <p className="text-sm text-[var(--on-surface-variant)]">{labels.loading}</p>
      </section>
    );
  }

  const headline =
    readiness.lifecycleStatus === "published"
      ? labels.published
      : readiness.lifecycleStatus === "archived"
        ? labels.archived
        : readiness.readyToPublish
          ? labels.readyToPublish
          : labels.notReady;

  const headlineTone =
    readiness.readyToPublish || readiness.lifecycleStatus === "published"
      ? "COMPLETE"
      : readiness.overallStatus;

  return (
    <section
      className={`clinical-card space-y-4 ${compact ? "p-4" : "p-5"}`}
      aria-labelledby="case-readiness-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          id="case-readiness-heading"
          tabIndex={-1}
          className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {labels.title}
        </h2>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[headlineTone]}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{STATUS_GLYPH[headlineTone]} </span>
          {headline}
        </p>
      </div>

      <ul className="space-y-2" aria-label={labels.title}>
        {readiness.items.map((it) => (
          <li
            key={it.id}
            className="flex gap-3 text-sm"
            data-status={it.status}
            data-section={it.id}
          >
            <span
              className={`mt-0.5 w-5 shrink-0 font-semibold ${STATUS_CLASS[it.status]}`}
              aria-hidden="true"
            >
              {STATUS_GLYPH[it.status]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium text-[var(--on-surface)]">
                  {it.label}
                </span>
                <span className="sr-only">{statusWord(it.status, labels)}</span>
              </div>
              {it.status !== "COMPLETE" ? (
                <p className="mt-0.5 text-[var(--on-surface-variant)]">
                  {it.explanation}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {readiness.arabicAuthorship === "stub" ? (
        <p
          className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-xs text-[var(--on-surface-variant)]"
          role="note"
        >
          {labels.arabicStubNote}
        </p>
      ) : null}

      <div className="border-t border-[var(--outline-variant)] pt-3">
        {!readiness.readyToPublish && readiness.blockedCount > 0 ? (
          <p className="text-sm font-medium text-[var(--on-surface)]" role="status">
            {labels.blockedCount.replace("{count}", String(readiness.blockedCount))}
          </p>
        ) : null}
        {readiness.nextAction ? (
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            <span className="font-medium text-[var(--on-surface)]">
              {labels.nextAction}:{" "}
            </span>
            {readiness.nextAction}
          </p>
        ) : null}
        {onReview && !readiness.readyToPublish ? (
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            onClick={onReview}
          >
            {labels.reviewReadiness}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Compact publish-gate callout used next to the Publish control. */
export function PublishReadinessCallout({
  readiness,
  labels = DEFAULT_READINESS_LABELS,
  onReview,
}: {
  readiness: CaseReadinessResult | null;
  labels?: CaseReadinessLabels;
  onReview?: () => void;
}) {
  if (!readiness) return null;
  if (
    readiness.lifecycleStatus === "published" ||
    readiness.lifecycleStatus === "archived"
  ) {
    return null;
  }

  if (readiness.readyToPublish) {
    return (
      <div
        className="max-w-sm rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-start text-xs"
        role="status"
      >
        <p className={`font-semibold ${STATUS_CLASS.COMPLETE}`}>
          <span aria-hidden="true">✓ </span>
          {labels.readyToPublish}
        </p>
      </div>
    );
  }

  const blockers = readiness.publishBlockers.slice(0, 5);
  return (
    <div
      className="max-w-sm rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-start text-xs"
      role="status"
      aria-live="polite"
    >
      <p className={`font-semibold ${STATUS_CLASS.BLOCKED}`}>
        {labels.publishUnavailable}
      </p>
      <p className="mt-1 text-[var(--on-surface-variant)]">
        {labels.blockedCount.replace("{count}", String(readiness.blockedCount || blockers.length))}
      </p>
      {blockers.length ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[var(--on-surface-variant)]">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {onReview ? (
        <button
          type="button"
          className="btn-secondary mt-2 text-[11px]"
          onClick={onReview}
        >
          {labels.reviewReadiness}
        </button>
      ) : null}
    </div>
  );
}
