import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { resolveApprovalStatus } from "@/lib/account-approval";
import { AccountApprovalActions } from "@/components/admin/AccountApprovalActions";
import { AssignedPatientsEditor } from "@/components/admin/AssignedPatientsEditor";
import {
  avatarDisplayName,
  avatarLocalNameSelect,
} from "@/lib/avatars/localized-name";
import { loadLadderAvatarIds } from "@/lib/training-ladder";
import type { TraineePatientAssignment } from "@/lib/types";

type AccountRow = {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  approval_status: string;
  created_at: string;
  approval_decided_at: string | null;
};

/**
 * Superadmin approves or rejects every new account before it can be used, and
 * can edit (name, role), revoke or delete any account but their own.
 */
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

  const locale = await getLocale();
  const tPatients = await getTranslations("admin.accounts.patients");

  // Course patients: published free-practice patients (Training Program
  // patients are only played through their levels) and who has which.
  const [{ data: avatarRows, error: avatarsError }, { data: assignmentRows, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("avatars")
        .select(`id, name, ${avatarLocalNameSelect(locale)}`)
        .eq("is_active", true)
        .order("name"),
      supabase.from("trainee_patient_assignments").select("trainee_id, avatar_id"),
    ]);
  let ladderIds = new Set<string>();
  let ladderError = false;
  try {
    ladderIds = await loadLadderAvatarIds(supabase);
  } catch {
    ladderError = true;
  }
  if (avatarsError || assignmentsError || ladderError) {
    console.error("[admin/accounts] course patients load failed", {
      avatars: avatarsError?.code,
      assignments: assignmentsError?.code,
      ladder: ladderError,
    });
  }
  const patientsUnavailable = Boolean(avatarsError || assignmentsError || ladderError);
  const patients = (
    (avatarRows ?? []) as unknown as Array<{ id: string; name: string; local_name?: string | null }>
  ).map((a) => ({ id: a.id, name: avatarDisplayName(a) }));
  const patientName = new Map(patients.map((p) => [p.id, p.name]));
  const freePatients = patients.filter((p) => !ladderIds.has(p.id));
  const assignments = (assignmentRows ?? []) as Pick<
    TraineePatientAssignment,
    "trainee_id" | "avatar_id"
  >[];

  const dateFmt = new Intl.DateTimeFormat(locale, {
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
            {a.id === user.id && (
              <span className="status-chip ms-2">{t("youBadge")}</span>
            )}
          </p>
          <p className="truncate text-sm text-[var(--on-surface-variant)]" dir="ltr">
            {a.email ?? "—"}
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("signedUp", { date: dateFmt.format(new Date(a.created_at)) })}
          </p>
        </div>
        <AccountApprovalActions
          userId={a.id}
          status={a.status}
          name={a.display_name}
          email={a.email}
          role={a.role === "admin" ? "admin" : "therapist"}
          isSelf={a.id === user.id}
        />
        {a.status === "approved" && a.role !== "admin" && (
          <div className="basis-full">
            {patientsUnavailable ? (
              <p role="alert" className="text-sm text-[var(--error)]">
                {tPatients("loadError")}
              </p>
            ) : (
              (() => {
                const mine = assignments
                  .filter((x) => x.trainee_id === a.id)
                  .map((x) => ({
                    id: x.avatar_id,
                    name: patientName.get(x.avatar_id) ?? "—",
                  }));
                const mineIds = new Set(mine.map((p) => p.id));
                return (
                  <AssignedPatientsEditor
                    trainee={{ id: a.id, name: a.display_name }}
                    assigned={mine}
                    candidates={freePatients.filter((p) => !mineIds.has(p.id))}
                  />
                );
              })()
            )}
          </div>
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
