"use client";

import { useEffect, useState } from "react";
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
};

export function AdminFeedbackPanel() {
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
          setError(json.error ?? "Failed to load");
          setLoading(false);
          return;
        }
        setItems(json.items ?? []);
        setSummary(json.summary ?? null);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Network error");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function triage(id: string, status: FeedbackStatus) {
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setReloadKey((k) => k + 1);
  }

  if (loading) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>;
  }
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>;

  return (
    <div className="space-y-8">
      {summary ? (
        <ul className="flex flex-wrap gap-6 text-sm">
          <li>Total: {summary.total}</li>
          <li>Open critical: {summary.open_critical}</li>
        </ul>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
              <th className="py-2 pe-3 font-medium">Severity</th>
              <th className="py-2 pe-3 font-medium">Priority</th>
              <th className="py-2 pe-3 font-medium">Status</th>
              <th className="py-2 pe-3 font-medium">Role</th>
              <th className="py-2 pe-3 font-medium">Institution</th>
              <th className="py-2 pe-3 font-medium">Title</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[var(--outline-variant)] align-top"
              >
                <td className="py-2 pe-3">{item.severity}</td>
                <td className="py-2 pe-3">{item.priority}</td>
                <td className="py-2 pe-3">{item.status}</td>
                <td className="py-2 pe-3">
                  {item.role_persona ?? item.submitter_role}
                </td>
                <td className="py-2 pe-3">
                  {item.institution_name}
                  {item.department ? ` / ${item.department}` : ""}
                </td>
                <td className="py-2 pe-3">
                  <p className="font-medium">{item.title || "(untitled)"}</p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    {item.category} · v{item.platform_version} ·{" "}
                    {item.reproducibility}
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
                      Triage
                    </button>
                    <button
                      type="button"
                      className="text-start text-xs text-[var(--primary)]"
                      onClick={() => void triage(item.id, "in_progress")}
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      className="text-start text-xs text-[var(--primary)]"
                      onClick={() => void triage(item.id, "resolved")}
                    >
                      Resolve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
            No institutional feedback yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
