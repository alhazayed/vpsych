"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";
import {
  PublishReadinessCallout,
  type CaseReadinessLabels,
} from "@/components/admin/CaseReadinessPanel";
import { educatorAdminError } from "@/lib/admin/admin-product-errors";

/**
 * Contextual lifecycle actions for Virtual Patient detail (Option B).
 */
export function VirtualPatientLifecycleActions({
  avatarId,
  slug,
  lifecycleStatus,
  readiness = null,
  readinessLabels,
  onReviewReadiness,
}: {
  avatarId: string;
  slug: string | null;
  lifecycleStatus: VirtualPatientLifecycleStatus;
  readiness?: CaseReadinessResult | null;
  readinessLabels?: CaseReadinessLabels;
  onReviewReadiness?: () => void;
}) {
  const t = useTranslations("admin.avatars.lifecycle");
  const tErrors = useTranslations("admin.productErrors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dupSlug, setDupSlug] = useState("");
  const dialogTitleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const publishCancelRef = useRef<HTMLButtonElement>(null);

  const publishBlocked =
    readiness != null &&
    !readiness.readyToPublish &&
    (lifecycleStatus === "draft" || lifecycleStatus === "testing");

  useEffect(() => {
    if (duplicateOpen) {
      firstFieldRef.current?.focus();
    } else if (publishOpen) {
      publishCancelRef.current?.focus();
    }
    if (!duplicateOpen && !publishOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDuplicateOpen(false);
        setPublishOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [duplicateOpen, publishOpen]);

  function mapError(raw: unknown, fallback: string): string {
    return educatorAdminError(raw, (key) => tErrors(key), fallback);
  }

  async function post(path: string, body?: unknown) {
    setError(null);
    setMessage(null);
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function openDuplicate() {
    const suggested = slug ? `${slug}-copy` : "patient-copy";
    setDupSlug(suggested);
    setDuplicateOpen(true);
  }

  async function confirmDuplicate() {
    if (!dupSlug.trim()) return;
    try {
      const { res, data } = await post(`/api/admin/avatars/${avatarId}/duplicate`, {
        slug: dupSlug.trim(),
      });
      if (!res.ok) {
        setError(mapError(data.error ?? data.code, t("duplicateFailed")));
        return;
      }
      setDuplicateOpen(false);
      setMessage(t("duplicated"));
      router.push(`/admin/avatars/${data.avatar.id}`);
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function confirmPublish() {
    if (publishBlocked) {
      setError(t("publishBlockedHint"));
      onReviewReadiness?.();
      setPublishOpen(false);
      return;
    }
    try {
      const { res, data } = await post(`/api/admin/avatars/${avatarId}/publish`);
      if (!res.ok) {
        const issueHint =
          Array.isArray(data.issues) && data.issues.length
            ? `: ${data.issues
                .slice(0, 3)
                .map((i: { message?: string }) => i.message)
                .filter(Boolean)
                .join("; ")}`
            : "";
        setError(
          mapError(data.error ?? data.code, t("publishFailed")) + issueHint,
        );
        onReviewReadiness?.();
        setPublishOpen(false);
        return;
      }
      setPublishOpen(false);
      setMessage(t("published"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function archive() {
    if (!window.confirm(t("archiveConfirm"))) return;
    try {
      const { res, data } = await post(`/api/admin/avatars/${avatarId}/archive`);
      if (!res.ok) {
        setError(mapError(data.error ?? data.code, t("archiveFailed")));
        return;
      }
      setMessage(t("archived"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function restore() {
    try {
      const { res, data } = await post(`/api/admin/avatars/${avatarId}/restore`);
      if (!res.ok) {
        setError(mapError(data.error ?? data.code, t("restoreFailed")));
        return;
      }
      setMessage(t("restored"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function toTesting() {
    try {
      const { res, data } = await post(
        `/api/admin/avatars/${avatarId}/lifecycle`,
        { status: "testing" },
      );
      if (!res.ok) {
        setError(mapError(data.error ?? data.code, t("testingFailed")));
        return;
      }
      setMessage(t("movedToTesting"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function toDraft() {
    try {
      const { res, data } = await post(
        `/api/admin/avatars/${avatarId}/lifecycle`,
        { status: "draft" },
      );
      if (!res.ok) {
        setError(mapError(data.error ?? data.code, t("draftFailed")));
        return;
      }
      setMessage(t("returnedToDraft"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  const statusHelp =
    lifecycleStatus === "draft"
      ? t("statusDraftHelp")
      : lifecycleStatus === "testing"
        ? t("statusTestingHelp")
        : lifecycleStatus === "published"
          ? t("statusPublishedHelp")
          : t("statusArchivedHelp");

  const publishButton = (
    <button
      type="button"
      className="btn-primary"
      disabled={pending || publishBlocked}
      aria-disabled={pending || publishBlocked}
      title={publishBlocked ? t("publishBlockedHint") : undefined}
      onClick={() => setPublishOpen(true)}
    >
      {t("publish")}
    </button>
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="max-w-sm text-end text-xs text-[var(--on-surface-variant)]">
        {statusHelp}
      </p>
      {(lifecycleStatus === "published" || lifecycleStatus === "archived") && (
        <p className="max-w-sm text-end text-xs text-[var(--on-surface-variant)]">
          {t("immutableEditHint")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={openDuplicate}
        >
          {t("duplicate")}
        </button>

        {lifecycleStatus === "draft" ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => startTransition(() => void toTesting())}
            >
              {t("moveToTesting")}
            </button>
            {publishButton}
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => startTransition(() => void archive())}
            >
              {t("archive")}
            </button>
          </>
        ) : null}

        {lifecycleStatus === "testing" ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => startTransition(() => void toDraft())}
            >
              {t("returnToDraft")}
            </button>
            {publishButton}
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => startTransition(() => void archive())}
            >
              {t("archive")}
            </button>
          </>
        ) : null}

        {lifecycleStatus === "published" ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => startTransition(() => void archive())}
          >
            {t("archive")}
          </button>
        ) : null}

        {lifecycleStatus === "archived" ? (
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => startTransition(() => void restore())}
          >
            {t("restore")}
          </button>
        ) : null}
      </div>

      {(lifecycleStatus === "draft" || lifecycleStatus === "testing") &&
      readiness ? (
        <PublishReadinessCallout
          readiness={readiness}
          labels={readinessLabels}
          onReview={onReviewReadiness}
        />
      ) : null}

      {error ? (
        <p role="alert" className="max-w-sm text-end text-xs text-[var(--error)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="max-w-sm text-end text-xs text-[var(--on-surface-variant)]">
          {message}
        </p>
      ) : null}

      {duplicateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDuplicateOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-md rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] p-5 shadow-lg"
          >
            <h2
              id={dialogTitleId}
              className="text-base font-semibold text-[var(--on-surface)]"
            >
              {t("duplicateTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {t("duplicateHelp")}
            </p>
            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-[var(--outline)]">
              {t("duplicateIdLabel")}
              <input
                ref={firstFieldRef}
                className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]"
                value={dupSlug}
                onChange={(e) => setDupSlug(e.target.value)}
                required
              />
              <span className="font-normal text-[var(--on-surface-variant)]">
                {t("duplicateIdHint")}
              </span>
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDuplicateOpen(false)}
              >
                {t("duplicateCancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending || !dupSlug.trim()}
                onClick={() => startTransition(() => void confirmDuplicate())}
              >
                {t("duplicateConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {publishOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPublishOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogTitleId}-publish`}
            className="w-full max-w-md rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] p-5 shadow-lg"
          >
            <h2
              id={`${dialogTitleId}-publish`}
              className="text-base font-semibold text-[var(--on-surface)]"
            >
              {t("publishConfirmTitle")}
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {t("publishConfirmBody")}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                ref={publishCancelRef}
                onClick={() => setPublishOpen(false)}
              >
                {t("publishCancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={() => startTransition(() => void confirmPublish())}
              >
                {t("publishConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
