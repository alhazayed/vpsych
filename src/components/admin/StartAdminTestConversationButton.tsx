"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { assertAvatarEligibleForAdminTest } from "@/lib/admin/admin-test-session";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";

/**
 * Starts Phase 3C Admin Test Conversation for a Virtual Patient in Testing.
 */
export function StartAdminTestConversationButton({
  avatarId,
  lifecycleStatus,
}: {
  avatarId: string;
  lifecycleStatus: VirtualPatientLifecycleStatus;
}) {
  const t = useTranslations("admin.avatars.testConversation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const eligible = assertAvatarEligibleForAdminTest(lifecycleStatus);
  if (!eligible.ok) return null;

  async function start() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/avatars/${avatarId}/test-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        path?: string;
        sessionId?: string;
      };
      if (!res.ok) {
        setError(data.error ?? t("failed"));
        return;
      }
      if (data.path) {
        router.push(data.path);
        router.refresh();
        return;
      }
      setError(t("failed"));
    } catch {
      setError(t("failed"));
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void start())}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-60"
      >
        {pending ? t("starting") : t("start")}
      </button>
      <p className="max-w-xs text-end text-[11px] text-[var(--on-surface-variant)]">
        {t("hint")}
      </p>
      {error ? (
        <p className="max-w-xs text-end text-xs text-[var(--error)]">{error}</p>
      ) : null}
    </div>
  );
}
