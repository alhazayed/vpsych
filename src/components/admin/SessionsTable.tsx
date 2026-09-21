"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/AdminUi";
import {
  sessionStatusTone,
  type AdminSessionListRow,
} from "@/lib/admin/session-ops";
import type { SessionStatus } from "@/lib/types";

export function SessionsTable({
  rows,
  labels,
}: {
  rows: AdminSessionListRow[];
  labels: {
    searchPlaceholder: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyFilteredTitle: string;
    emptyFilteredDescription: string;
    clearFilters: string;
    colSession: string;
    colLearner: string;
    colScenario: string;
    colOrganization: string;
    colStarted: string;
    colDuration: string;
    colStatus: string;
    colAssessment: string;
    colReport: string;
    colActions: string;
    filterStatus: string;
    filterReport: string;
    filterAll: string;
    statusActive: string;
    statusCompleted: string;
    statusExpired: string;
    reportAvailable: string;
    reportNone: string;
    actionView: string;
    actionReport: string;
    adminTest: string;
    showing: string;
    unassignedOrg: string;
    staleBadge: string;
  };
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SessionStatus>("all");
  const [report, setReport] = useState<"all" | "available" | "none">("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (report !== "all" && r.reportStatus !== report) return false;
      if (!query) return true;
      return (
        r.id.toLowerCase().includes(query) ||
        r.learner.toLowerCase().includes(query) ||
        r.patient.toLowerCase().includes(query) ||
        r.disorder.toLowerCase().includes(query) ||
        (r.organization ?? "").toLowerCase().includes(query)
      );
    });
  }, [rows, q, status, report]);

  const statusLabel = (s: SessionStatus) => {
    if (s === "active") return labels.statusActive;
    if (s === "completed") return labels.statusCompleted;
    return labels.statusExpired;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-4 py-4 md:px-6">
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-[var(--on-surface-variant)]">
          <span className="mb-1 block">{labels.searchPlaceholder}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="text-xs font-medium text-[var(--on-surface-variant)]">
          <span className="mb-1 block">{labels.filterStatus}</span>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "all" | SessionStatus)
            }
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm"
          >
            <option value="all">{labels.filterAll}</option>
            <option value="active">{labels.statusActive}</option>
            <option value="completed">{labels.statusCompleted}</option>
            <option value="expired">{labels.statusExpired}</option>
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--on-surface-variant)]">
          <span className="mb-1 block">{labels.filterReport}</span>
          <select
            value={report}
            onChange={(e) =>
              setReport(e.target.value as "all" | "available" | "none")
            }
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm"
          >
            <option value="all">{labels.filterAll}</option>
            <option value="available">{labels.reportAvailable}</option>
            <option value="none">{labels.reportNone}</option>
          </select>
        </label>
        {(q || status !== "all" || report !== "all") && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setQ("");
              setStatus("all");
              setReport("all");
            }}
          >
            {labels.clearFilters}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            rows.length === 0 ? labels.emptyTitle : labels.emptyFilteredTitle
          }
          description={
            rows.length === 0
              ? labels.emptyDescription
              : labels.emptyFilteredDescription
          }
          icon="clinical_notes"
          action={
            q || status !== "all" || report !== "all" ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                  setReport("all");
                }}
              >
                {labels.clearFilters}
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <p className="px-4 py-2 text-xs text-[var(--on-surface-variant)] md:px-6">
            {labels.showing.replace("#COUNT#", String(filtered.length))}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  <th className="px-4 py-3 font-bold md:px-6">
                    {labels.colSession}
                  </th>
                  <th className="px-4 py-3 font-bold">{labels.colLearner}</th>
                  <th className="px-4 py-3 font-bold">{labels.colScenario}</th>
                  <th className="hidden px-4 py-3 font-bold lg:table-cell">
                    {labels.colOrganization}
                  </th>
                  <th className="px-4 py-3 font-bold">{labels.colStarted}</th>
                  <th className="hidden px-4 py-3 font-bold md:table-cell">
                    {labels.colDuration}
                  </th>
                  <th className="px-4 py-3 font-bold">{labels.colStatus}</th>
                  <th className="px-4 py-3 font-bold">{labels.colAssessment}</th>
                  <th className="px-4 py-3 font-bold">{labels.colReport}</th>
                  <th className="px-4 py-3 font-bold text-end md:px-6">
                    {labels.colActions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[var(--surface-container-low)]"
                  >
                    <td className="px-4 py-3 md:px-6">
                      <Link
                        href={`/admin/sessions/${r.id}`}
                        className="font-mono text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        {r.id.slice(0, 8)}
                      </Link>
                      {r.isAdminTest ? (
                        <span className="ms-2 align-middle">
                          <StatusBadge
                            label={labels.adminTest}
                            tone="warning"
                          />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{r.learner}</td>
                    <td className="px-4 py-3">
                      <p>{r.patient}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {r.disorder}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--on-surface-variant)] lg:table-cell">
                      {r.organization ?? labels.unassignedOrg}
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--on-surface-variant)] md:table-cell">
                      {r.durationLabel ?? "—"}
                      {r.durationStale ? (
                        <span className="ms-2">
                          <StatusBadge
                            label={labels.staleBadge}
                            tone="warning"
                          />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={statusLabel(r.status)}
                        tone={sessionStatusTone(r.status)}
                      />
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-headline)] font-semibold text-[var(--primary)]">
                      {r.score != null ? r.score : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={
                          r.reportStatus === "available"
                            ? labels.reportAvailable
                            : labels.reportNone
                        }
                        tone={
                          r.reportStatus === "available" ? "active" : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-end md:px-6">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/sessions/${r.id}`}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          {labels.actionView}
                        </Link>
                        {r.reportStatus === "available" ? (
                          <Link
                            href={`/admin/reports/${r.id}`}
                            className="text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            {labels.actionReport}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
