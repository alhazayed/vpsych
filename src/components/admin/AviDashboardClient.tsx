"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  avi_version: string;
  overall_mean: number | null;
  n: number;
  mean_variance: number | null;
  stability_trend: Array<{
    at: string;
    mean: number;
    variance: number | null;
    n: number;
  }>;
  validity_summary: {
    mean_avi: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    heuristic_share: number | null;
    external_criterion_disclosed: boolean;
    recommendations: string[];
  };
  by_mode: Array<{
    key: string;
    n: number;
    mean: number;
    ci95: { lower: number; upper: number };
  }>;
  by_language: Array<{
    key: string;
    n: number;
    mean: number;
    ci95: { lower: number; upper: number };
  }>;
  low_avi_recommendations: string[];
};

type WeightRow = { id: string; weight: number; rationale: string };

export function AviDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/avi");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        weight_matrix?: WeightRow[];
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load AVI");
      setDashboard(json.dashboard ?? null);
      setWeights(json.weight_matrix ?? []);
      setSource(json.source ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recompute = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/avi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persist: false }),
      });
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Compute failed");
      setDashboard(json.dashboard ?? null);
      setSource("offline_corpus");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const maxTrend = Math.max(
    1,
    ...(dashboard?.stability_trend.map((t) => t.mean) ?? [1]),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void recompute()}
          disabled={busy}
          className="rounded-md border border-[var(--outline-variant)] px-4 py-2 text-sm font-semibold text-[var(--on-surface)] disabled:opacity-50"
        >
          Recompute corpus
        </button>
        {source ? (
          <span className="text-xs text-[var(--outline)]">Source: {source}</span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Mean AVI"
          value={
            dashboard?.overall_mean != null ? `${dashboard.overall_mean}` : "—"
          }
          hint="/100"
        />
        <Stat
          label="Cases"
          value={String(dashboard?.n ?? 0)}
          hint="corpus"
        />
        <Stat
          label="Mean variance"
          value={
            dashboard?.mean_variance != null
              ? `${dashboard.mean_variance}`
              : "—"
          }
          hint="repeats"
        />
        <Stat
          label="AVI version"
          value={dashboard?.avi_version ?? "—"}
          hint="locked"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Scoring stability trend
        </h2>
        <div className="flex h-40 items-end gap-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] p-4">
          {(dashboard?.stability_trend ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No trend points yet — recompute corpus.
            </p>
          ) : (
            dashboard!.stability_trend.map((t) => (
              <div
                key={t.at}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${t.at}: AVI ${t.mean}, var=${t.variance ?? "n/a"} (n=${t.n})`}
              >
                <div
                  className="w-full rounded-t bg-[var(--secondary)]"
                  style={{
                    height: `${(t.mean / maxTrend) * 100}%`,
                    minHeight: 4,
                  }}
                />
                <span className="truncate text-[9px] text-[var(--outline)]">
                  {t.at.slice(5)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Validity report summary
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
            <p>
              Mean AVI:{" "}
              <strong>{dashboard?.validity_summary.mean_avi ?? "—"}</strong>
            </p>
            <p>
              Heuristic share:{" "}
              <strong>
                {dashboard?.validity_summary.heuristic_share != null
                  ? `${dashboard.validity_summary.heuristic_share}%`
                  : "—"}
              </strong>
            </p>
            <p>
              External criterion disclosed:{" "}
              <strong>
                {dashboard?.validity_summary.external_criterion_disclosed
                  ? "yes"
                  : "no"}
              </strong>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              Low-dimension hotspots
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {(
                dashboard?.validity_summary.low_dimension_hotspots ?? []
              ).map((h) => (
                <li key={h.id}>
                  <span className="font-mono text-xs">{h.id}</span> — {h.mean}
                  /100 (n={h.n})
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Per-mode comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Mean</th>
                  <th className="px-3 py-2">95% CI</th>
                  <th className="px-3 py-2">n</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.by_mode ?? []).map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-[var(--outline-variant)]"
                  >
                    <td className="px-3 py-2 font-medium">{r.key}</td>
                    <td className="px-3 py-2">{r.mean}</td>
                    <td className="px-3 py-2 text-[var(--on-surface-variant)]">
                      [{r.ci95.lower}, {r.ci95.upper}]
                    </td>
                    <td className="px-3 py-2">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Per-language comparison
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Language</th>
                <th className="px-3 py-2">Mean</th>
                <th className="px-3 py-2">95% CI</th>
                <th className="px-3 py-2">n</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.by_language ?? []).map((r) => (
                <tr
                  key={r.key}
                  className="border-t border-[var(--outline-variant)]"
                >
                  <td className="px-3 py-2 font-medium">{r.key}</td>
                  <td className="px-3 py-2">{r.mean}</td>
                  <td className="px-3 py-2 text-[var(--on-surface-variant)]">
                    [{r.ci95.lower}, {r.ci95.upper}]
                  </td>
                  <td className="px-3 py-2">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Recommendations (low AVI)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--on-surface)]">
          {(dashboard?.low_avi_recommendations ?? []).length === 0 ? (
            <li>No low-AVI recommendations in current corpus.</li>
          ) : (
            dashboard!.low_avi_recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Weight matrix (AVI v{dashboard?.avi_version ?? "1.0.0"})
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Dimension</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w) => (
                <tr
                  key={w.id}
                  className="border-t border-[var(--outline-variant)]"
                >
                  <td className="px-3 py-2 font-mono text-xs">{w.id}</td>
                  <td className="px-3 py-2">
                    {(w.weight * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-[var(--on-surface-variant)]">
                    {w.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="clinical-card flex flex-col justify-between p-6">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {label}
        </p>
        <h3 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {value}
          <span className="ml-1 text-sm font-semibold text-[var(--on-surface-variant)]">
            {hint}
          </span>
        </h3>
      </div>
    </div>
  );
}
