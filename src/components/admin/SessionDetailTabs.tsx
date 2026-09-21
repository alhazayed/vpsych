"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/AdminUi";
import { AdvancedDetails, AdvancedJson } from "@/components/admin/AdvancedDetails";
import { sessionStatusTone } from "@/lib/admin/session-ops";
import type { MessageRole, SessionStatus } from "@/lib/types";

type TabId = "overview" | "conversation" | "assessment" | "report" | "technical";

export type SessionDetailMessage = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type SessionDetailScoreItem = {
  id: string;
  label: string;
  score: number;
  max: number;
  weight: number;
  feedback: string;
};

export function SessionDetailTabs({
  session,
  messages,
  report,
  labels,
  locale,
}: {
  session: {
    id: string;
    status: SessionStatus;
    startedAt: string;
    endedAt: string | null;
    language: string | null;
    learner: string;
    learnerId?: string | null;
    patient: string;
    disorder: string;
    organization: string | null;
    difficulty: string | null;
    modality: string | null;
    interactionMode: string | null;
    isAdminTest: boolean;
    caseInstanceId: string | null;
    clinicalSnapshot: unknown;
    immersionMetrics: unknown;
    /** Pre-formatted, status-aware duration from the server */
    durationLabel: string | null;
    durationStale?: boolean;
  };
  messages: SessionDetailMessage[];
  report: {
    id: string;
    overall: number | null;
    narrative: string | null;
    items: SessionDetailScoreItem[];
    language: string | null;
    createdAt: string | null;
  } | null;
  labels: {
    tabOverview: string;
    tabConversation: string;
    tabAssessment: string;
    tabReport: string;
    tabTechnical: string;
    sessionId: string;
    learner: string;
    organization: string;
    scenario: string;
    virtualPatient: string;
    started: string;
    ended: string;
    duration: string;
    status: string;
    language: string;
    difficulty: string;
    modality: string;
    interactionMode: string;
    unassignedOrg: string;
    statusActive: string;
    statusCompleted: string;
    statusExpired: string;
    adminTest: string;
    simulationNotice: string;
    emptyConversation: string;
    roleSystem: string;
    roleLearner: string;
    rolePatient: string;
    turns: string;
    noAssessment: string;
    noAssessmentHint: string;
    overall: string;
    rubric: string;
    noReport: string;
    noReportHint: string;
    viewFullReport: string;
    narrative: string;
    technicalIntro: string;
    caseInstance: string;
    clinicalSnapshot: string;
    immersion: string;
    none: string;
    staleBadge: string;
    staleExplanation: string;
    viewLearner: string;
  };
  locale: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const statusLabel =
    session.status === "active"
      ? labels.statusActive
      : session.status === "completed"
        ? labels.statusCompleted
        : labels.statusExpired;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: labels.tabOverview },
    { id: "conversation", label: labels.tabConversation },
    { id: "assessment", label: labels.tabAssessment },
    { id: "report", label: labels.tabReport },
    { id: "technical", label: labels.tabTechnical },
  ];

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
    [locale],
  );

  const roleLabel: Record<MessageRole, string> = {
    system: labels.roleSystem,
    user: labels.roleLearner,
    assistant: labels.rolePatient,
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Session detail"
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
            {labels.simulationNotice}
          </p>
          {session.isAdminTest ? (
            <StatusBadge label={labels.adminTest} tone="warning" />
          ) : null}
          {session.durationStale ? (
            <p
              className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--secondary-container)_35%,transparent)] px-3 py-2 text-xs text-[var(--on-surface)]"
              role="status"
            >
              {labels.staleExplanation}
            </p>
          ) : null}
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label={labels.sessionId} value={session.id} mono />
            <DetailItem
              label={labels.status}
              value={
                <StatusBadge
                  label={statusLabel}
                  tone={sessionStatusTone(session.status)}
                />
              }
            />
            <DetailItem
              label={labels.learner}
              value={
                session.learnerId ? (
                  <Link
                    href={`/admin/learners/${session.learnerId}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {session.learner}
                  </Link>
                ) : (
                  session.learner
                )
              }
            />
            <DetailItem
              label={labels.organization}
              value={session.organization ?? labels.unassignedOrg}
            />
            <DetailItem label={labels.virtualPatient} value={session.patient} />
            <DetailItem label={labels.scenario} value={session.disorder} />
            <DetailItem
              label={labels.started}
              value={time.format(new Date(session.startedAt))}
            />
            <DetailItem
              label={labels.ended}
              value={
                session.endedAt
                  ? time.format(new Date(session.endedAt))
                  : labels.none
              }
            />
            <DetailItem
              label={labels.duration}
              value={
                session.durationLabel ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {session.durationLabel}
                    {session.durationStale ? (
                      <StatusBadge
                        label={labels.staleBadge}
                        tone="warning"
                      />
                    ) : null}
                  </span>
                ) : (
                  labels.none
                )
              }
            />
            <DetailItem
              label={labels.language}
              value={(session.language ?? "—").toUpperCase()}
            />
            <DetailItem
              label={labels.difficulty}
              value={session.difficulty ?? labels.none}
            />
            <DetailItem
              label={labels.modality}
              value={session.modality ?? labels.none}
            />
            <DetailItem
              label={labels.interactionMode}
              value={session.interactionMode ?? labels.none}
            />
          </dl>
        </section>
      ) : null}

      {tab === "conversation" ? (
        messages.length === 0 ? (
          <EmptyState
            title={labels.emptyConversation}
            icon="forum"
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--on-surface-variant)]">
              {labels.turns}
            </p>
            <ol className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                        m.role === "user"
                          ? "text-[var(--primary)]"
                          : m.role === "assistant"
                            ? "text-[var(--secondary)]"
                            : "text-[var(--outline)]"
                      }`}
                    >
                      {roleLabel[m.role]}
                    </span>
                    <time className="text-xs text-[var(--on-surface-variant)]">
                      {time.format(new Date(m.created_at))}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--on-surface)]">
                    {m.content}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )
      ) : null}

      {tab === "assessment" ? (
        !report || report.overall == null ? (
          <EmptyState
            title={labels.noAssessment}
            description={labels.noAssessmentHint}
            icon="assignment"
          />
        ) : (
          <section className="space-y-4">
            <div className="clinical-card flex items-end justify-between gap-4 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  {labels.overall}
                </p>
                <p className="font-[family-name:var(--font-headline)] text-4xl font-bold text-[var(--primary)]">
                  {report.overall}
                </p>
              </div>
            </div>
            {report.items.length > 0 ? (
              <div className="clinical-card overflow-hidden">
                <div className="border-b border-[var(--outline-variant)] px-5 py-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                    {labels.rubric}
                  </h3>
                </div>
                <ul className="divide-y divide-[var(--surface-container)]">
                  {report.items.map((item) => {
                    const pct = item.max
                      ? Math.round((item.score / item.max) * 100)
                      : 0;
                    return (
                      <li key={item.id} className="px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium">{item.label}</p>
                          <p className="font-mono text-sm text-[var(--primary)]">
                            {item.score}/{item.max}
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                          <div
                            className="h-1.5 rounded-full bg-[var(--primary)]"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        {item.feedback ? (
                          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                            {item.feedback}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        )
      ) : null}

      {tab === "report" ? (
        !report ? (
          <EmptyState
            title={labels.noReport}
            description={labels.noReportHint}
            icon="description"
          />
        ) : (
          <section className="clinical-card space-y-4 p-5">
            {report.narrative ? (
              <div>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  {labels.narrative}
                </h3>
                <p className="text-sm leading-7 text-[var(--on-surface)]">
                  {report.narrative}
                </p>
              </div>
            ) : null}
            <Link href={`/admin/reports/${session.id}`} className="btn-primary">
              {labels.viewFullReport}
            </Link>
          </section>
        )
      ) : null}

      {tab === "technical" ? (
        <section className="clinical-card space-y-4 p-5">
          <p className="text-sm text-[var(--on-surface-variant)]">
            {labels.technicalIntro}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <DetailItem
              label={labels.caseInstance}
              value={session.caseInstanceId ?? labels.none}
              mono
            />
            <DetailItem
              label={labels.interactionMode}
              value={session.interactionMode ?? labels.none}
            />
          </dl>
          <AdvancedDetails title={labels.clinicalSnapshot}>
            <AdvancedJson value={session.clinicalSnapshot} />
          </AdvancedDetails>
          {session.immersionMetrics ? (
            <AdvancedDetails title={labels.immersion}>
              <AdvancedJson value={session.immersionMetrics} />
            </AdvancedDetails>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-[var(--on-surface)] ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
