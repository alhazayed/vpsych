"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("feedback");
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
      if (!res.ok) {
        // The API's messages are English; pick the copy from the status.
        setError(
          t(
            res.status === 400
              ? "errors.invalid"
              : res.status === 401
                ? "errors.signedOut"
                : res.status === 429
                  ? "errors.rateLimited"
                  : "errors.failed",
          ),
        );
        return;
      }
      setOk(true);
      setTitle("");
      setBody("");
      setSuggestedAction("");
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-md border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <p className="text-xs text-[var(--on-surface-variant)]">
        {t("noPhi")}
      </p>

      <label className="block text-sm">
        {t("fields.role")}
        <select
          className={field}
          value={submitterRole}
          onChange={(e) => setSubmitterRole(e.target.value as FeedbackRole)}
        >
          {FEEDBACK_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        {t("fields.institution")}
        <input
          className={field}
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          required
          maxLength={200}
        />
      </label>

      <label className="block text-sm">
        {t("fields.department")}
        <input
          className={field}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          maxLength={120}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          {t("fields.category")}
          <select
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t("fields.severity")}
          <select
            className={field}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
          >
            {FEEDBACK_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`severities.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t("fields.reproducibility")}
          <select
            className={field}
            value={reproducibility}
            onChange={(e) =>
              setReproducibility(e.target.value as FeedbackReproducibility)
            }
          >
            {FEEDBACK_REPRODUCIBILITY.map((r) => (
              <option key={r} value={r}>
                {t(`reproducibility.${r}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        {t("fields.title")}
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
        {t("fields.body")}
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
        {t("fields.suggestedAction")}
        <textarea
          className={`${field} min-h-[80px]`}
          value={suggestedAction}
          onChange={(e) => setSuggestedAction(e.target.value)}
          maxLength={2000}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="text-sm text-[var(--primary)]">
          {t("submitted")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-60"
      >
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
