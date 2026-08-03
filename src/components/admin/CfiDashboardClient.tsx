"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  cfi_version: string;
  overall_mean: number | null;
  n: number;
  trend: Array<{ at: string; mean: number; n: number }>;
  by_disorder: Array<{
    key: string;
    n: number;
    mean: number;
    sd: number;
    min: number;
    max: number;
    ci95: { lower: number; upper: number };
  }>;
  by_language: Array<{
    key: string;
    n: number;
    mean: number;
    sd: number;
    ci95: { lower: number; upper: number };
  }>;
  low_cfi_recommendations: string[];
};

type WeightRow = { id: string; weight: number; rationale: string };

export function CfiDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cfi");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        weight_matrix?: WeightRow[];
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load CFI");
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
      const res = await fetch("/api/admin/cfi", {
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

  const maxTrend = Math.max(1, ...(dashboard?.trend.map((t) => t.mean) ?? [1]));

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

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Mean CFI"
          value={
            dashboard?.overall_mean != null
              ? `${dashboard.overall_mean}`
              : "—"
          }
          hint="/100"
        />
        <Stat label="Scored cases" value={String(dashboard?.n ?? 0)} hint="corpus" />
        <Stat
          label="CFI version"
          value={dashboard?.cfi_version ?? "—"}
          hint="weight matrix locked"
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Trend
        </h2>
        <div className="flex h-40 items-end gap-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] p-4">
          {(dashboard?.trend ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No trend points yet — recompute corpus.
            </p>
          ) : (
            dashboard!.trend.map((t) => (
              <div
                key={t.at}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${t.at}: ${t.mean} (n=${t.n})`}
              >
                <div
                  className="w-full rounded-t bg-[var(--secondary)]"
                  style={{ height: `${(t.mean / maxTrend) * 100}%`, minHeight: 4 }}
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
            Per-disorder comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-2">Disorder</th>
                  <th className="px-3 py-2">Mean</th>
                  <th className="px-3 py-2">95% CI</th>
                  <th className="px-3 py-2">n</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.by_disorder ?? []).map((r) => (
                  <tr key={r.key} className="border-t border-[var(--outline-variant)]">
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

        <div className="space-y-3">
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
                  <tr key={r.key} className="border-t border-[var(--outline-variant)]">
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
          Recommendations (low CFI)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--on-surface)]">
          {(dashboard?.low_cfi_recommendations ?? []).length === 0 ? (
            <li>No low-CFI recommendations in current corpus.</li>
          ) : (
            dashboard!.low_cfi_recommendations.map((r) => <li key={r}>{r}</li>)
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Weight matrix (CFI v{dashboard?.cfi_version ?? "1.0.0"})
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
                <tr key={w.id} className="border-t border-[var(--outline-variant)]">
                  <td className="px-3 py-2 font-mono text-xs">{w.id}</td>
                  <td className="px-3 py-2">{(w.weight * 100).toFixed(0)}%</td>
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
