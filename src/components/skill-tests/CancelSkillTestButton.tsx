"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { skillTestCancelErrorKey } from "@/lib/skill-tests/client-errors";

export function CancelSkillTestButton({ skillTestId }: { skillTestId: string }) {
  const router = useRouter();
  const t = useTranslations("skillTests.supervise");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/skill-tests/${skillTestId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setError(t(skillTestCancelErrorKey(res.status, data.code)));
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => void cancel()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? t("cancelling") : t("cancel")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
