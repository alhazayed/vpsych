"use client";

import { useCallback, useState, startTransition } from "react";
import { useTranslations } from "next-intl";

type Dash = {
  source: string;
  dashboard: {
    totals: {
      flags: number;
      clusters: number;
      critical: number;
      high: number;
    };
    score_averages: Record<string, number | null>;
    by_disorder: Array<{ disorder: string; n: number; avg_clinical?: number }>;
    by_category: Array<{ category: string; n: number }>;
    top_clusters: Array<{
      title: string;
      report_count: number;
      severity: string | null;
      confidence_pct: number;
    }>;
  };
  recent_flags: Array<{
    id: string;
    created_at: string;
    category: string;
    severity: string;
    disorder_slug: string | null;
    language: string | null;
    free_text_preview: string;
  }>;
};

export function CqiAdminDashboard() {
  const t = useTranslations("admin.cqi");
  const [data, setData] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/cqi");
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
      const res = await fetch("/api/admin/cqi/analyze", { method: "POST" });
      const body = (await res.json()) as {
        ok?: boolean;
        analyst?: { cluster_count: number };
        error?: string;
      };
      if (!res.ok) {
        setMsg(body.error || t("analystFailed"));
      } else {
        setMsg(
          t("analystDone", { n: body.analyst?.cluster_count ?? 0 }),
        );
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
          href="/api/admin/cqi/export?format=package"
        >
          {t("export")}
        </a>
        <a
          className="btn-secondary h-10 px-4 text-sm leading-10"
          href="/api/admin/cqi/export?format=csv&redact=1"
        >
          {t("exportCsv")}
        </a>
        {data && (
          <span className="text-xs text-[var(--on-surface-variant)]">
            {t("source", { source: data.source })}
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--on-surface-variant)]">
        {t("approvalNote")}
      </p>
      {msg && (
        <p className="text-sm text-[var(--primary)]" role="status">
          {msg}
        </p>
      )}

      {!d || d.totals.flags === 0 ? (
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
                [t("flags"), d.totals.flags],
                [t("clusters"), d.totals.clusters],
                [t("critical"), d.totals.critical],
                [t("high"), d.totals.high],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[var(--outline-variant)] bg-white p-4"
                >
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {label}
                  </p>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("topClusters")}
              </h2>
              <ul className="space-y-2">
                {d.top_clusters.map((c) => (
                  <li
                    key={c.title}
                    className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      n={c.report_count} · {c.severity} ·{" "}
                      {c.confidence_pct}% confidence
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("scoreAverages")}
              </h2>
              <ul className="space-y-1 text-sm">
                {Object.entries(d.score_averages).map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-[var(--outline-variant)] py-1">
                    <span>{k.replace(/_/g, " ")}</span>
                    <span className="font-semibold">{v ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("byDisorder")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.by_disorder.slice(0, 12).map((r) => (
                  <li key={r.disorder} className="flex justify-between">
                    <span>{r.disorder}</span>
                    <span>
                      {r.n}
                      {r.avg_clinical != null
                        ? ` · clinical ${r.avg_clinical}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("byCategory")}
              </h2>
              <ul className="space-y-1 text-sm">
                {d.by_category.map((r) => (
                  <li key={r.category} className="flex justify-between">
                    <span>{r.category.replace(/_/g, " ")}</span>
                    <span>{r.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {t("recentFlags")}
            </h2>
            <ul className="space-y-2">
              {(data?.recent_flags ?? []).map((f) => (
                <li
                  key={f.id}
                  className="rounded-lg border border-[var(--outline-variant)] bg-white px-4 py-3 text-sm"
                >
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {f.created_at.slice(0, 19)} · {f.severity} · {f.category}
                    {f.disorder_slug ? ` · ${f.disorder_slug}` : ""}
                    {f.language ? ` · ${f.language}` : ""}
                  </p>
                  <p>{f.free_text_preview}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
