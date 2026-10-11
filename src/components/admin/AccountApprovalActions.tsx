"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  DISPLAY_NAME_MAX_LENGTH,
  type ApprovalStatus,
} from "@/lib/account-approval";

type Busy = "approve" | "reject" | "edit" | "delete";
type Panel = "none" | "edit" | "delete";
type Role = "therapist" | "admin";

/**
 * Approve / revoke / edit / delete for one account on Admin > Account
 * approvals. Approval applies to non-admin accounts only (an admin is always
 * approved; demote first to revoke). Nobody can revoke, delete or change the
 * role of their own account.
 */
export function AccountApprovalActions({
  userId,
  status,
  name,
  email,
  role,
  isSelf,
}: {
  userId: string;
  status: ApprovalStatus;
  /** Shown in confirmations so the admin knows whose account it is. */
  name: string;
  email: string | null;
  role: Role;
  isSelf: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const formId = useId();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [draftName, setDraftName] = useState(name);
  const [draftRole, setDraftRole] = useState<Role>(role);
  const [confirmText, setConfirmText] = useState("");

  // Delete asks the admin to type the email (or the name, for an account
  // without one) so a misclick cannot remove someone.
  const confirmTarget = (email ?? name).trim();
  const deleteArmed =
    confirmText.trim().toLowerCase() === confirmTarget.toLowerCase();

  async function send(
    kind: Busy,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(kind);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/accounts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { code?: string } | null;
        setError(
          kind === "delete" && data?.code === "SUPERVISED_TESTS"
            ? t("deleteSupervisedTests")
            : kind === "delete"
              ? t("deleteFailed")
              : t("changeFailed"),
        );
        setBusy(null);
        return false;
      }
      setBusy(null);
      setDone(true);
      router.refresh();
      return true;
    } catch {
      setError(t("networkError"));
      setBusy(null);
      return false;
    }
  }

  async function decide(decision: "approve" | "reject") {
    // Rejecting or revoking locks the person out of every page; ask first.
    if (decision === "reject") {
      const key = status === "approved" ? "revokeConfirm" : "rejectConfirm";
      if (!window.confirm(t(key, { name }))) return;
    }
    await send(decision, "POST", { decision });
  }

  async function saveEdit() {
    const body: Record<string, unknown> = {};
    const trimmed = draftName.replace(/\s+/g, " ").trim();
    if (trimmed !== name) body.displayName = trimmed;
    if (!isSelf && draftRole !== role) body.role = draftRole;
    if (Object.keys(body).length === 0) {
      setPanel("none");
      return;
    }
    if (body.role === "admin" && !window.confirm(t("makeAdminConfirm", { name }))) {
      return;
    }
    if (await send("edit", "PATCH", body)) setPanel("none");
  }

  async function confirmDelete() {
    if (!deleteArmed) return;
    if (await send("delete", "DELETE", {})) setPanel("none");
  }

  const isAdmin = role === "admin";
  const nameValid =
    draftName.trim().length > 0 && draftName.trim().length <= DISPLAY_NAME_MAX_LENGTH;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!isAdmin && !isSelf && status !== "approved" && (
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
        {!isAdmin && !isSelf && status !== "rejected" && (
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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setDraftName(name);
            setDraftRole(role);
            setError(null);
            setPanel(panel === "edit" ? "none" : "edit");
          }}
          disabled={busy !== null}
          aria-expanded={panel === "edit"}
          aria-controls={`${formId}-edit`}
        >
          {t("edit")}
        </button>
        {!isSelf && (
          <button
            type="button"
            className="btn-secondary"
            style={{ color: "var(--error)" }}
            onClick={() => {
              setConfirmText("");
              setError(null);
              setPanel(panel === "delete" ? "none" : "delete");
            }}
            disabled={busy !== null}
            aria-expanded={panel === "delete"}
            aria-controls={`${formId}-delete`}
          >
            {t("delete")}
          </button>
        )}
      </div>

      {panel === "edit" && (
        <form
          id={`${formId}-edit`}
          className="flex w-full flex-col gap-2 rounded-lg border border-[var(--outline-variant)] p-3 sm:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          <label className="text-xs font-semibold" htmlFor={`${formId}-name`}>
            {t("nameLabel")}
          </label>
          <input
            id={`${formId}-name`}
            className="field-input"
            value={draftName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            onChange={(e) => setDraftName(e.target.value)}
            required
          />
          <label className="text-xs font-semibold" htmlFor={`${formId}-role`}>
            {t("roleLabel")}
          </label>
          <select
            id={`${formId}-role`}
            className="field-input"
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value as Role)}
            disabled={isSelf}
            aria-describedby={isSelf ? `${formId}-role-hint` : undefined}
          >
            <option value="therapist">{t("roleTrainee")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
          {isSelf && (
            <p id={`${formId}-role-hint`} className="text-xs text-[var(--on-surface-variant)]">
              {t("ownRoleHint")}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={busy !== null || !nameValid}
              aria-busy={busy === "edit"}
            >
              {busy === "edit" ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPanel("none")}
              disabled={busy !== null}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {panel === "delete" && (
        <div
          id={`${formId}-delete`}
          className="flex w-full flex-col gap-2 rounded-lg border border-[var(--error)] p-3 sm:w-80"
        >
          <p className="text-sm font-semibold">{t("deleteTitle", { name })}</p>
          <p className="text-xs text-[var(--on-surface-variant)]">{t("deleteWarning")}</p>
          <label className="text-xs font-semibold" htmlFor={`${formId}-confirm`}>
            {t("deleteTypeToConfirm", { target: confirmTarget })}
          </label>
          <input
            id={`${formId}-confirm`}
            className="field-input"
            dir="ltr"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              style={{ background: "var(--error)", color: "#fff" }}
              onClick={() => void confirmDelete()}
              disabled={busy !== null || !deleteArmed}
              aria-busy={busy === "delete"}
            >
              {busy === "delete" ? t("deleting") : t("deleteForever")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPanel("none")}
              disabled={busy !== null}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

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
