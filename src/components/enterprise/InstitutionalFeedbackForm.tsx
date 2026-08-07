"use client";

import { useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_REPRODUCIBILITY,
  FEEDBACK_ROLES,
  FEEDBACK_SEVERITIES,
  type FeedbackRole,
  type FeedbackSeverity,
  type FeedbackReproducibility,
} from "@/lib/enterprise/feedback";

export function InstitutionalFeedbackForm({
  defaultRole = "resident",
}: {
  defaultRole?: FeedbackRole;
}) {
  const [submitterRole, setSubmitterRole] =
    useState<FeedbackRole>(defaultRole);
  const [institutionName, setInstitutionName] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState<string>(FEEDBACK_CATEGORIES[0]);
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [reproducibility, setReproducibility] =
    useState<FeedbackReproducibility>("unknown");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [suggestedAction, setSuggestedAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submitter_role: submitterRole,
          institution_name: institutionName,
          department,
          category,
          severity,
          reproducibility,
          title,
          body,
          suggested_action: suggestedAction,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Submit failed");
        return;
      }
      setOk(true);
      setTitle("");
      setBody("");
      setSuggestedAction("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-md border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <p className="text-xs text-[var(--on-surface-variant)]">
        Do not enter real patient names, MRNs, or other PHI. Use fictional
        session IDs only.
      </p>

      <label className="block text-sm">
        Role
        <select
          className={field}
          value={submitterRole}
          onChange={(e) => setSubmitterRole(e.target.value as FeedbackRole)}
        >
          {FEEDBACK_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Institution
        <input
          className={field}
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          required
          maxLength={200}
        />
      </label>

      <label className="block text-sm">
        Department
        <input
          className={field}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          maxLength={120}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Category
          <select
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Severity
          <select
            className={field}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
          >
            {FEEDBACK_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Reproducibility
          <select
            className={field}
            value={reproducibility}
            onChange={(e) =>
              setReproducibility(e.target.value as FeedbackReproducibility)
            }
          >
            {FEEDBACK_REPRODUCIBILITY.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        Title
        <input
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={200}
        />
      </label>

      <label className="block text-sm">
        Description
        <textarea
          className={`${field} min-h-[120px]`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={10}
          maxLength={8000}
        />
      </label>

      <label className="block text-sm">
        Suggested action
        <textarea
          className={`${field} min-h-[80px]`}
          value={suggestedAction}
          onChange={(e) => setSuggestedAction(e.target.value)}
          maxLength={2000}
        />
      </label>

      {error ? (
        <p className="text-sm text-[var(--error)]">{error}</p>
      ) : null}
      {ok ? (
        <p className="text-sm text-[var(--primary)]">Feedback submitted.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}
