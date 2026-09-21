"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/AdminUi";
import {
  sessionStatusTone,
  type AdminSessionListRow,
} from "@/lib/admin/session-ops";
import type { SessionStatus } from "@/lib/types";

type TabId =
  | "overview"
  | "sessions"
  | "performance"
  | "competencies"
  | "activity";

export function LearnerDetailTabs({
  overview,
  sessions,
  performance,
  competencies,
  labels,
  locale,
}: {
  overview: {
    trainingLevel: string | null;
    profession: string | null;
    completedCases: number | null;
    certification: string | null;
    hasAce: boolean;
    learnerId: string;
  };
  sessions: AdminSessionListRow[];
  performance: Array<{
    sessionId: string;
    reportId: string;
    patient: string;
    overall: number | null;
    createdAt: string;
    status: string;
  }>;
  competencies: Array<{
    competency: string;
    score: number | null;
    updatedAt: string | null;
  }>;
  labels: {
    tabOverview: string;
    tabSessions: string;
    tabPerformance: string;
    tabCompetencies: string;
    tabActivity: string;
    overviewIntro: string;
    educationNotice: string;
    aceLink: string;
    cgeLink: string;
    emptySessions: string;
    emptyPerformance: string;
    emptyCompetencies: string;
    emptyCompetenciesHint: string;
    emptyActivity: string;
    colSession: string;
    colScenario: string;
    colStarted: string;
    colDuration: string;
    colStatus: string;
    colScore: string;
    colReport: string;
    statusActive: string;
    statusCompleted: string;
    statusExpired: string;
    reportAvailable: string;
    reportNone: string;
    actionView: string;
    actionReport: string;
    staleBadge: string;
    competency: string;
    competencyScore: string;
    competencyUpdated: string;
    activitySession: string;
    activityReport: string;
    trainingLevel: string;
    profession: string;
    completedCases: string;
    certification: string;
    none: string;
    sessionsSampleHint: string;
  };
  locale: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: labels.tabOverview },
    { id: "sessions", label: labels.tabSessions },
    { id: "performance", label: labels.tabPerformance },
    { id: "competencies", label: labels.tabCompetencies },
    { id: "activity", label: labels.tabActivity },
  ];

  const statusLabel = (s: SessionStatus) => {
    if (s === "active") return labels.statusActive;
    if (s === "completed") return labels.statusCompleted;
    return labels.statusExpired;
  };

  const activity = useMemo(() => {
    const items: Array<{
      id: string;
      kind: "session" | "report";
      label: string;
      at: string;
      href: string;
    }> = [];
    for (const s of sessions.slice(0, 20)) {
      items.push({
        id: `s-${s.id}`,
        kind: "session",
        label: `${labels.activitySession}: ${s.patient}`,
        at: s.endedAt ?? s.startedAt,
        href: `/admin/sessions/${s.id}`,
      });
      if (s.reportStatus === "available") {
        items.push({
          id: `r-${s.id}`,
          kind: "report",
          label: `${labels.activityReport}: ${s.patient}`,
          at: s.endedAt ?? s.startedAt,
          href: `/admin/reports/${s.id}`,
        });
      }
    }
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 25);
  }, [sessions, labels.activitySession, labels.activityReport]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Learner profile"
        className="mb-6 flex flex-wrap gap-1 border-b border-[var(--outline-variant)]"
      >
        {tabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <section className="clinical-card space-y-4 p-5">
          <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-xs text-[var(--on-surface-variant)]">
            {labels.educationNotice}
          </p>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {labels.overviewIntro}
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem
              label={labels.trainingLevel}
              value={overview.trainingLevel ?? labels.none}
            />
            <DetailItem
              label={labels.profession}
              value={overview.profession ?? labels.none}
            />
            <DetailItem
              label={labels.completedCases}
              value={
                overview.completedCases != null
                  ? String(overview.completedCases)
                  : labels.none
              }
            />
            <DetailItem
              label={labels.certification}
              value={overview.certification ?? labels.none}
            />
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/curriculum" className="btn-secondary">
              {labels.aceLink}
            </Link>
            <Link href="/admin/graph" className="btn-secondary">
              {labels.cgeLink}
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "sessions" ? (
        sessions.length === 0 ? (
          <EmptyState title={labels.emptySessions} icon="clinical_notes" />
        ) : (
          <div className="clinical-card overflow-hidden">
            <p className="border-b border-[var(--outline-variant)] px-4 py-2 text-xs text-[var(--on-surface-variant)] md:px-6">
              {labels.sessionsSampleHint}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                    <th className="px-4 py-3 font-bold md:px-6">
                      {labels.colSession}
                    </th>
                    <th className="px-4 py-3 font-bold">{labels.colScenario}</th>
                    <th className="px-4 py-3 font-bold">{labels.colStarted}</th>
                    <th className="hidden px-4 py-3 font-bold md:table-cell">
                      {labels.colDuration}
                    </th>
                    <th className="px-4 py-3 font-bold">{labels.colStatus}</th>
                    <th className="px-4 py-3 font-bold">{labels.colScore}</th>
                    <th className="px-4 py-3 font-bold text-end md:px-6">
                      {labels.colReport}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-container)]">
                  {sessions.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 md:px-6">
                        <Link
                          href={`/admin/sessions/${r.id}`}
                          className="font-mono text-xs text-[var(--primary)] hover:underline"
                        >
                          {r.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p>{r.patient}</p>
                        <p className="text-xs text-[var(--on-surface-variant)]">
                          {r.disorder}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                        {time.format(new Date(r.startedAt))}
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
                      <td className="px-4 py-3 font-semibold text-[var(--primary)]">
                        {r.score != null ? r.score : "—"}
                      </td>
                      <td className="px-4 py-3 text-end md:px-6">
                        {r.reportStatus === "available" ? (
                          <Link
                            href={`/admin/reports/${r.id}`}
                            className="text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            {labels.actionReport}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--on-surface-variant)]">
                            {labels.reportNone}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {tab === "performance" ? (
        performance.length === 0 ? (
          <EmptyState title={labels.emptyPerformance} icon="assignment" />
        ) : (
          <ul className="space-y-2">
            {performance.map((p) => (
              <li key={p.reportId}>
                <Link
                  href={`/admin/reports/${p.sessionId}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-4 py-3 hover:bg-[var(--surface-container-low)]"
                >
                  <span>
                    {p.patient}
                    <span className="ms-2 text-xs text-[var(--on-surface-variant)]">
                      {time.format(new Date(p.createdAt))}
                    </span>
                  </span>
                  <span className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--primary)]">
                    {p.overall != null ? p.overall : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "competencies" ? (
        competencies.length === 0 ? (
          <EmptyState
            title={labels.emptyCompetencies}
            description={labels.emptyCompetenciesHint}
            icon="account_tree"
            action={
              <Link href="/admin/curriculum" className="btn-secondary">
                {labels.aceLink}
              </Link>
            }
          />
        ) : (
          <div className="clinical-card overflow-hidden">
            <table className="w-full min-w-[480px] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  <th className="px-4 py-3 font-bold md:px-6">
                    {labels.competency}
                  </th>
                  <th className="px-4 py-3 font-bold">
                    {labels.competencyScore}
                  </th>
                  <th className="px-4 py-3 font-bold md:px-6">
                    {labels.competencyUpdated}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {competencies.map((c) => (
                  <tr key={c.competency}>
                    <td className="px-4 py-3 md:px-6">{c.competency}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-[var(--primary)]">
                      {c.score != null ? Math.round(c.score) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface-variant)] md:px-6">
                      {c.updatedAt
                        ? time.format(new Date(c.updatedAt))
                        : labels.none}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "activity" ? (
        activity.length === 0 ? (
          <EmptyState title={labels.emptyActivity} icon="history" />
        ) : (
          <ol className="space-y-2">
            {activity.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-4 py-3 text-sm hover:bg-[var(--surface-container-low)]"
                >
                  <span>{a.label}</span>
                  <time className="text-xs text-[var(--on-surface-variant)]">
                    {time.format(new Date(a.at))}
                  </time>
                </Link>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--on-surface)]">{value}</dd>
    </div>
  );
}
