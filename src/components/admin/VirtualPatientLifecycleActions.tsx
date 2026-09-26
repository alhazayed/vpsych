"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";
import {
  PublishReadinessCallout,
  type CaseReadinessLabels,
} from "@/components/admin/CaseReadinessPanel";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const publishBlocked =
    readiness != null &&
    !readiness.readyToPublish &&
    (lifecycleStatus === "draft" || lifecycleStatus === "testing");

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

  async function duplicate() {
    const suggested = slug ? `${slug}-copy` : "patient-copy";
    const nextSlug = window.prompt(t("duplicatePrompt"), suggested);
    if (!nextSlug?.trim()) return;
    try {
      const { res, data } = await post(`/api/admin/avatars/${avatarId}/duplicate`, {
        slug: nextSlug.trim(),
      });
      if (!res.ok) {
        setError(data.error ?? t("duplicateFailed"));
        return;
      }
      setMessage(t("duplicated"));
      router.push(`/admin/avatars/${data.avatar.id}`);
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function publish() {
    if (publishBlocked) {
      setError(t("publishBlockedHint"));
      onReviewReadiness?.();
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
        setError((data.error ?? t("publishFailed")) + issueHint);
        onReviewReadiness?.();
        return;
      }
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
        setError(data.error ?? t("archiveFailed"));
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
        setError(data.error ?? t("restoreFailed"));
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
        setError(data.error ?? t("testingFailed"));
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
        setError(data.error ?? t("draftFailed"));
        return;
      }
      setMessage(t("returnedToDraft"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  const publishButton = (
    <button
      type="button"
      className="btn-primary"
      disabled={pending || publishBlocked}
      aria-disabled={pending || publishBlocked}
      title={publishBlocked ? t("publishBlockedHint") : undefined}
      onClick={() => startTransition(() => void publish())}
    >
      {t("publish")}
    </button>
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => startTransition(() => void duplicate())}
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
    </div>
  );
}
