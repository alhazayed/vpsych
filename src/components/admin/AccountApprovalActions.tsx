"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApprovalStatus } from "@/lib/account-approval";

type Decision = "approve" | "reject";

/** Approve / reject buttons for one account on Admin > Account approvals. */
export function AccountApprovalActions({
  userId,
  status,
}: {
  userId: string;
  status: ApprovalStatus;
}) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function decide(decision: Decision) {
    setBusy(decision);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, decision }),
      });
      if (!res.ok) {
        setError(t("changeFailed"));
        setBusy(null);
        return;
      }
      setDone(true);
      setBusy(null);
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "approved" && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void decide("approve")}
            disabled={busy !== null}
            aria-busy={busy === "approve"}
          >
            {busy === "approve" ? t("saving") : t("approve")}
          </button>
        )}
        {status !== "rejected" && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void decide("reject")}
            disabled={busy !== null}
            aria-busy={busy === "reject"}
          >
            {busy === "reject"
              ? t("saving")
              : status === "approved"
                ? t("revoke")
                : t("reject")}
          </button>
        )}
      </div>
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
