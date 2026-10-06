import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { resolveApprovalStatus } from "@/lib/account-approval";
import { AccountApprovalActions } from "@/components/admin/AccountApprovalActions";

type AccountRow = {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  approval_status: string;
  created_at: string;
  approval_decided_at: string | null;
};

/** Superadmin approves or rejects every new account before it can be used. */
export default async function AdminAccountsPage() {
  const { supabase, user } = await requireAdmin();
  const t = await getTranslations("admin.accounts");

  const { data, error } = await supabase.rpc("list_account_approvals");
  if (error) console.warn("[admin/accounts] list:", error.message);
  const accounts = ((data ?? []) as AccountRow[]).map((a) => ({
    ...a,
    status: resolveApprovalStatus(a),
  }));
  const pending = accounts.filter((a) => a.status === "pending");
  const others = accounts.filter((a) => a.status !== "pending");

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function row(a: (typeof accounts)[number]) {
    const statusLabel =
      a.status === "pending"
        ? t("statusPending")
        : a.status === "rejected"
          ? t("statusRejected")
          : t("statusApproved");
    const chip =
      a.status === "approved"
        ? "status-chip status-chip-active"
        : "status-chip";
    return (
      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-semibold">
            {a.display_name}
            <span className={`${chip} ms-2`}>{statusLabel}</span>
            {a.role === "admin" && (
              <span className="status-chip ms-2">{t("adminBadge")}</span>
            )}
          </p>
          <p className="truncate text-sm text-[var(--on-surface-variant)]" dir="ltr">
            {a.email ?? "—"}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("signedUp", { date: dateFmt.format(new Date(a.created_at)) })}
          </p>
        </div>
        {a.role !== "admin" && a.id !== user.id && (
          <AccountApprovalActions userId={a.id} status={a.status} />
        )}
      </li>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="mb-6 mt-2 text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>

      {error ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold">
            {t("pendingCount", { count: pending.length })}
          </h2>
          {pending.length === 0 ? (
            <p className="clinical-card mb-8 p-5 text-sm text-[var(--on-surface-variant)]">
              {t("noPending")}
            </p>
          ) : (
            <ul className="clinical-card mb-8 divide-y divide-[var(--outline-variant)]">
              {pending.map(row)}
            </ul>
          )}

          <h2 className="mb-3 text-sm font-semibold">{t("allAccounts")}</h2>
          {others.length === 0 ? (
            <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
              {t("empty")}
            </p>
          ) : (
            <ul className="clinical-card divide-y divide-[var(--outline-variant)]">
              {others.map(row)}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
