"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/AdminUi";

export type ReportRow = {
  id: string;
  sessionId: string;
  learner: string;
  patient: string;
  disorder: string;
  language: string;
  score: number | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  createdAtLabel: string;
};

export function ReportsTable({
  rows,
  labels,
}: {
  rows: ReportRow[];
  labels: {
    searchPlaceholder: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyFilteredTitle: string;
    emptyFilteredDescription: string;
    clearFilters: string;
    colLearner: string;
    colPatient: string;
    colDate: string;
    colStatus: string;
    colScore: string;
    colLanguage: string;
    showingLabel: string;
    filterLanguage: string;
    filterAll: string;
  };
}) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (lang !== "all" && r.language.toLowerCase() !== lang) return false;
      if (!query) return true;
      return (
        r.learner.toLowerCase().includes(query) ||
        r.patient.toLowerCase().includes(query) ||
        r.disorder.toLowerCase().includes(query) ||
        r.sessionId.toLowerCase().includes(query)
      );
    });
  }, [rows, q, lang]);

  const languages = useMemo(() => {
    const set = new Set(rows.map((r) => r.language.toLowerCase()));
    return Array.from(set).sort();
  }, [rows]);

  const filtersActive = Boolean(q || lang !== "all");

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
          <span className="mb-1 block">{labels.filterLanguage}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm"
          >
            <option value="all">{labels.filterAll}</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {filtersActive && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setQ("");
              setLang("all");
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
          icon="assignment"
          action={
            filtersActive ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setQ("");
                  setLang("all");
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
            {labels.showingLabel.replace("#COUNT#", String(filtered.length))}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  <th className="px-4 py-3 font-bold md:px-6">
                    {labels.colLearner}
                  </th>
                  <th className="px-4 py-3 font-bold">{labels.colPatient}</th>
                  <th className="px-4 py-3 font-bold">{labels.colDate}</th>
                  <th className="px-4 py-3 font-bold">{labels.colLanguage}</th>
                  <th className="px-4 py-3 font-bold">{labels.colStatus}</th>
                  <th className="px-4 py-3 font-bold text-end md:px-6">
                    {labels.colScore}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--surface-container-low)]">
                    <td className="px-4 py-3 md:px-6">
                      <Link
                        href={`/admin/reports/${r.sessionId}`}
                        className="font-medium text-[var(--primary)] hover:underline"
                      >
                        {r.learner}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[var(--on-surface)]">{r.patient}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {r.disorder}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                      {r.createdAtLabel}
                    </td>
                    <td className="px-4 py-3 uppercase text-[var(--on-surface-variant)]">
                      {r.language}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={r.statusLabel}
                        tone={
                          r.status === "completed"
                            ? "active"
                            : r.status === "expired"
                              ? "warning"
                              : "info"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-end font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)] md:px-6">
                      {r.score != null ? r.score : "—"}
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
