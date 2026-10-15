"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { codeLabel } from "@/lib/admin/ops-text";
import type { FeedbackStatus } from "@/lib/enterprise/feedback";

type FeedbackRow = {
  id: string;
  title: string;
  body: string;
  role_persona: string;
  submitter_role?: string;
  institution_name: string;
  department: string;
  category: string;
  severity: string;
  priority: string;
  status: FeedbackStatus;
  reproducibility: string;
  suggested_action: string;
  platform_version: string;
  created_at: string;
};

type Summary = {
  total: number;
  open_critical: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
  by_severity: Record<string, number>;
  by_classification?: Record<string, number>;
};

export function AdminFeedbackPanel() {
  const t = useTranslations("admin.feedbackPage");
  const tOps = useTranslations("admin.opsUi");
  const tForm = useTranslations("feedback");
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/feedback");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? tOps("loadFailed"));
          setLoading(false);
          return;
        }
        setItems(json.items ?? []);
        setSummary(json.summary ?? null);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(tOps("networkError"));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, tOps]);

  async function triage(id: string, status: FeedbackStatus) {
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {tOps("loading")}
      </p>
    );
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;

  return (
    <div className="space-y-8">
      {summary ? (
        <ul className="flex flex-wrap gap-6 text-sm">
          <li>{t("total", { count: summary.total })}</li>
          <li>{t("openCritical", { count: summary.open_critical })}</li>
          {summary.by_classification
            ? Object.entries(summary.by_classification).map(([k, v]) => (
                <li key={k}>
                  {codeLabel(tForm, "severities", k.toLowerCase())}: {v}
                </li>
              ))
            : null}
        </ul>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
              <th className="py-2 pe-3 font-medium">{t("colSeverity")}</th>
              <th className="py-2 pe-3 font-medium">{t("colPriority")}</th>
              <th className="py-2 pe-3 font-medium">{t("colStatus")}</th>
              <th className="py-2 pe-3 font-medium">{t("colRole")}</th>
              <th className="py-2 pe-3 font-medium">{t("colInstitution")}</th>
              <th className="py-2 pe-3 font-medium">{t("colTitle")}</th>
              <th className="py-2 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[var(--outline-variant)] align-top"
              >
                <td className="py-2 pe-3">
                  {codeLabel(tForm, "severities", item.severity)}
                </td>
                <td className="py-2 pe-3">
                  {codeLabel(t, "priorities", item.priority)}
                </td>
                <td className="py-2 pe-3">
                  {codeLabel(t, "statuses", item.status)}
                </td>
                <td className="py-2 pe-3">
                  {codeLabel(
                    tForm,
                    "roles",
                    item.role_persona ?? item.submitter_role,
                  )}
                </td>
                <td className="py-2 pe-3">
                  {item.institution_name}
                  {item.department ? ` / ${item.department}` : ""}
                </td>
                <td className="py-2 pe-3">
                  <p className="font-medium">{item.title || t("untitled")}</p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    {codeLabel(tForm, "categories", item.category)} · v
                    {item.platform_version} ·{" "}
                    {codeLabel(tForm, "reproducibility", item.reproducibility)}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-[var(--on-surface-variant)]">
                    {item.body.slice(0, 180)}
                    {item.body.length > 180 ? "…" : ""}
                  </p>
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="text-start text-xs text-[var(--primary)]"
                      onClick={() => void triage(item.id, "triaged")}
                    >
                      {t("actionTriage")}
                    </button>
                    <button
                      type="button"
                      className="text-start text-xs text-[var(--primary)]"
                      onClick={() => void triage(item.id, "in_progress")}
                    >
                      {t("actionInProgress")}
                    </button>
                    <button
                      type="button"
                      className="text-start text-xs text-[var(--primary)]"
                      onClick={() => void triage(item.id, "resolved")}
                    >
                      {t("actionResolve")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
            {t("empty")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
