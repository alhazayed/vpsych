"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

/**
 * Duplicate / deactivate / publish controls for Virtual Patient detail.
 * Calls Phase 3A lifecycle APIs; does not invent new persistence paths.
 */
export function VirtualPatientLifecycleActions({
  avatarId,
  slug,
  isActive,
}: {
  avatarId: string;
  slug: string | null;
  isActive: boolean;
}) {
  const t = useTranslations("admin.avatars.lifecycle");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function duplicate() {
    setError(null);
    setMessage(null);
    const suggested = slug ? `${slug}-copy` : "patient-copy";
    const nextSlug = window.prompt(t("duplicatePrompt"), suggested);
    if (!nextSlug?.trim()) return;
    try {
      const res = await fetch(`/api/admin/avatars/${avatarId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: nextSlug.trim() }),
      });
      const data = await res.json();
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

  async function deactivate() {
    setError(null);
    setMessage(null);
    if (!window.confirm(t("deactivateConfirm"))) return;
    try {
      const res = await fetch(`/api/admin/avatars/${avatarId}/deactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("deactivateFailed"));
        return;
      }
      setMessage(t("deactivated"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

  async function publish() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/avatars/${avatarId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("publishFailed"));
        return;
      }
      setMessage(t("published"));
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
  }

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
        {isActive ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => startTransition(() => void deactivate())}
          >
            {t("deactivate")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => startTransition(() => void publish())}
          >
            {t("publish")}
          </button>
        )}
      </div>
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
