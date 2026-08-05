"use client";

import { useCallback, useState, startTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

type Dash = {
  source: string;
  is_defect: false;
  dashboard: {
    totals: {
      opportunities: number;
      clusters: number;
      high_impact: number;
      accepted: number;
    };
    top_opportunities: Array<{
      title: string;
      report_count: number;
      educational_impact_avg: number;
      educational_priority: string;
      backlog_score: number;
    }>;
    by_type: Array<{ type: string; n: number }>;
    by_competency: Array<{ competency: string; n: number }>;
    by_learner: Array<{ learner: string; n: number }>;
    by_disorder: Array<{ disorder: string; n: number }>;
    backlog: Array<{
      title: string;
      backlog_score: number;
      educational_priority: string;
      effort_estimate: string;
      research_value: string;
    }>;
    trends: { by_release: Array<{ release: string; n: number }> };
  };
  recent: Array<{
    id: string;
    created_at: string;
    opportunity_type: string;
    educational_impact: number;
    disorder_slug: string | null;
    status: string;
    idea_preview: string;
    competencies: string[];
  }>;
};

export function EoiAdminDashboard() {
  const t = useTranslations("admin.eoi");
  const [data, setData] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/eoi");
    if (!res.ok) return;
    const json = (await res.json()) as Dash;
    startTransition(() => setData(json));
  }, []);

  const [booted, setBooted] = useState(false);
  if (!booted) {
    setBooted(true);
    void load();
  }

  async function runAnalyst() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/eoi/analyze", { method: "POST" });
      const body = (await res.json()) as {
        ok?: boolean;
        analyst?: { cluster_count: number };
        error?: string;
      };
      if (!res.ok) {
        setMsg(body.error || t("analystFailed"));
      } else {
        setMsg(t("analystDone", { n: body.analyst?.cluster_count ?? 0 }));
        await load();
      }
    } catch {
      setMsg(t("analystFailed"));
    } finally {
      setBusy(false);
    }
  }

  const d = data?.dashboard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary h-10 px-4 text-sm"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn-primary h-10 px-4 text-sm"
          disabled={busy}
          onClick={() => void runAnalyst()}
        >
          {t("runAnalyst")}
        </button>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/eoi/export?format=package"
        >
          {t("export")}
        </a>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/eoi/export?format=csv&redact=1"
        >
          {t("exportCsv")}
        </a>
        <Link
          href="/admin/cqi"
          className="btn-secondary h-10 px-4 text-sm leading-10"
        >
          {t("cqiLink")}
        </Link>
        {data && (
          <span className="text-xs text-[var(--on-surface-variant)]">
            {t("source", { source: data.source })}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--on-surface-variant)]">
        {t("separationNote")}
      </p>
      {msg && (
        <p className="text-sm text-[var(--primary)]" role="status">
          {msg}
        </p>
      )}

      {!d || d.totals.opportunities === 0 ? (
        <p className="rounded-xl border border-[var(--outline-variant)] bg-white p-6 text-sm">
          {t("noData")}
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("totals")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [t("opportunities"), d.totals.opportunities],
                [t("clusters"), d.totals.clusters],
                [t("highImpact"), d.totals.high_impact],
                [t("accepted"), d.totals.accepted],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[var(--outline-variant)] bg-white p-4"
                >
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-teal-800">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("topOpportunities")}
              </h2>
              <ul className="space-y-2">
                {d.top_opportunities.map((c) => (
                  <li
                    key={c.title}
                    className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      n={c.report_count} · impact {c.educational_impact_avg}/5 ·{" "}
                      {c.educational_priority} · score {c.backlog_score}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("backlog")}
              </h2>
              <ul className="space-y-2">
                {d.backlog.slice(0, 12).map((c) => (
                  <li
                    key={c.title}
                    className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {c.educational_priority} · effort {c.effort_estimate} ·{" "}
                      {c.research_value}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("byType")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.by_type.map((r) => (
                  <li key={r.type} className="flex justify-between">
                    <span>{r.type.replace(/_/g, " ")}</span>
                    <span>{r.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("byCompetency")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.by_competency.slice(0, 12).map((r) => (
                  <li key={r.competency} className="flex justify-between">
                    <span>{r.competency.replace(/_/g, " ")}</span>
                    <span>{r.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("byLearner")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.by_learner.map((r) => (
                  <li key={r.learner} className="flex justify-between">
                    <span>{r.learner.replace(/_/g, " ")}</span>
                    <span>{r.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("byDisorder")}
            </h2>
            <ul className="space-y-1 text-sm">
              {d.by_disorder.slice(0, 12).map((r) => (
                <li key={r.disorder} className="flex justify-between">
                  <span>{r.disorder}</span>
                  <span>{r.n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("recent")}
            </h2>
            <ul className="space-y-2">
              {(data?.recent ?? []).map((f) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                >
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {f.created_at.slice(0, 19)} · ★{f.educational_impact} ·{" "}
                    {f.opportunity_type} · {f.status}
                    {f.disorder_slug ? ` · ${f.disorder_slug}` : ""}
                  </p>
                  <p>{f.idea_preview}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
