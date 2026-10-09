"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Superadmin grants or revokes the supervisor role for one user. */
export function SupervisorRoleToggle({
  userId,
  isSupervisor,
  name,
}: {
  userId: string;
  isSupervisor: boolean;
  name: string;
}) {
  const router = useRouter();
  const t = useTranslations("skillTests.admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function change() {
    if (isSupervisor && !window.confirm(t("revokeConfirm", { name }))) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, grant: !isSupervisor }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("changeFailed"));
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={isSupervisor ? "btn-secondary" : "btn-primary"}
        onClick={() => void change()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? t("saving") : isSupervisor ? t("revoke") : t("grant")}
      </button>
      {done && (
        <span role="status" className="text-xs text-[var(--on-surface-variant)]">
          {t("saved")}
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-[var(--error)]">
          {error}
        </span>
      )}
    </div>
  );
}
