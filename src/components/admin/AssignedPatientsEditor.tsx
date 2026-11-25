"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Patient = { id: string; name: string };

function errorKey(status: number, code?: string | null) {
  if (code === "MFA_REQUIRED") return "mfaRequired";
  if (code === "PATIENT_UNAVAILABLE") return "patientUnavailable";
  if (code === "NOT_UPDATED" || status === 409) return "notApplied";
  if (status === 429) return "rateLimited";
  return "changeFailed";
}

/**
 * Superadmin assigns patients to one trainee, or removes one. With any
 * assigned patient the trainee practises only with those patients.
 */
export function AssignedPatientsEditor({
  trainee,
  assigned,
  candidates,
}: {
  trainee: { id: string; name: string };
  assigned: Patient[];
  /** Published patients not yet assigned to this trainee. */
  candidates: Patient[];
}) {
  const router = useRouter();
  const t = useTranslations("admin.accounts.patients");
  const id = useId();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function change(avatarId: string, assign: boolean, name: string) {
    if (!assign && !window.confirm(t("removeConfirm", { patient: name, name: trainee.name }))) {
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/accounts/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId: trainee.id, avatarId, assign }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setError(t(errorKey(res.status, data.code)));
        setBusy(false);
        return;
      }
      setDone(true);
      setChoice("");
      setBusy(false);
      router.refresh();
    } catch {
      setError(t("networkError"));
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-s-2 border-[var(--outline-variant)] ps-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
        {t("title")}
      </p>
      {assigned.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("none")}</p>
      ) : (
        <>
          <p className="text-xs text-[var(--on-surface-variant)]">{t("restricted")}</p>
          <ul className="space-y-1">
            {assigned.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{p.name}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void change(p.id, false, p.name)}
                >
                  {t("remove")}
                  <span className="sr-only"> — {p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {candidates.length > 0 && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const patient = candidates.find((c) => c.id === choice);
            if (patient) void change(patient.id, true, patient.name);
          }}
        >
          <label htmlFor={`${id}-patient`} className="sr-only">
            {t("choose")}
          </label>
          <select
            id={`${id}-patient`}
            className="field-input max-w-64"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !choice}
            aria-busy={busy}
          >
            {busy ? t("saving") : t("add")}
          </button>
        </form>
      )}
      {done && (
        <p role="status" className="text-xs text-[var(--on-surface-variant)]">
          {t("saved")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
