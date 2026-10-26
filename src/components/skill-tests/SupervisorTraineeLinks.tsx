"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { linkErrorKey } from "@/lib/supervisor-reviews/client-errors";

type Person = { id: string; display_name: string };

/** Superadmin links trainees to one supervisor, or removes a link. */
export function SupervisorTraineeLinks({
  supervisor,
  linked,
  candidates,
}: {
  supervisor: Person;
  linked: Person[];
  /** People who can be linked (not yet linked, not the supervisor). */
  candidates: Person[];
}) {
  const router = useRouter();
  const t = useTranslations("supervisorReviews.links");
  const id = useId();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function change(traineeId: string, link: boolean, name: string) {
    if (
      !link &&
      !window.confirm(t("removeConfirm", { name, supervisor: supervisor.display_name }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/admin/supervisors/trainees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supervisorId: supervisor.id, traineeId, link }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setError(t(linkErrorKey(res.status, data.code)));
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
      {linked.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("none")}</p>
      ) : (
        <ul className="space-y-1">
          {linked.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{p.display_name}</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void change(p.id, false, p.display_name)}
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const person = candidates.find((c) => c.id === choice);
            if (person) void change(person.id, true, person.display_name);
          }}
        >
          <label htmlFor={`${id}-trainee`} className="sr-only">
            {t("choose")}
          </label>
          <select
            id={`${id}-trainee`}
            className="field-input max-w-64"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
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
