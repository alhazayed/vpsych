"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  ale_version: string;
  overall_mean: number | null;
  n: number;
  learning_curves: Array<{
    archetype: string;
    points: Array<{ session: number; overall: number }>;
  }>;
  difficulty_curves: Array<{
    archetype: string;
    points: Array<{ session: number; difficulty: string; rank: number }>;
  }>;
  by_archetype: Array<{
    key: string;
    n: number;
    mean: number;
    ci95: { lower: number; upper: number };
  }>;
  curriculum_quality: {
    mean_ale: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    recommendations: string[];
  };
  low_ale_recommendations: string[];
};

type WeightRow = { id: string; weight: number; rationale: string };

export function AleDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ale");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        weight_matrix?: WeightRow[];
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load ALE");
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
      const res = await fetch("/api/admin/ale", {
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
          label="Mean ALE"
          value={
            dashboard?.overall_mean != null ? `${dashboard.overall_mean}` : "—"
          }
          hint="/100"
        />
        <Stat
          label="Learners"
          value={String(dashboard?.n ?? 0)}
          hint="archetypes"
        />
        <Stat
          label="ALE version"
          value={dashboard?.ale_version ?? "—"}
          hint="locked"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Learning curves
          </h2>
          <div className="space-y-4 rounded-lg border border-[var(--outline-variant)] p-4">
            {(dashboard?.learning_curves ?? []).length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                No learning curves — recompute corpus.
              </p>
            ) : (
              dashboard!.learning_curves.map((curve) => {
                const max = Math.max(
                  1,
                  ...curve.points.map((p) => p.overall),
                );
                return (
                  <div key={curve.archetype} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                      {curve.archetype}
                    </p>
                    <div className="flex h-24 items-end gap-0.5">
                      {curve.points.map((p) => (
                        <div
                          key={p.session}
                          className="flex flex-1 flex-col items-center justify-end"
                          title={`S${p.session}: ${p.overall}`}
                        >
                          <div
                            className="w-full rounded-t bg-[var(--secondary)]"
                            style={{
                              height: `${(p.overall / max) * 100}%`,
                              minHeight: 2,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Difficulty curves
          </h2>
          <div className="space-y-4 rounded-lg border border-[var(--outline-variant)] p-4">
            {(dashboard?.difficulty_curves ?? []).map((curve) => (
              <div key={curve.archetype} className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                  {curve.archetype}
                </p>
                <div className="flex h-24 items-end gap-0.5">
                  {curve.points.map((p) => (
                    <div
                      key={p.session}
                      className="flex flex-1 flex-col items-center justify-end"
                      title={`S${p.session}: ${p.difficulty}`}
                    >
                      <div
                        className="w-full rounded-t bg-[var(--primary)]"
                        style={{
                          height: `${((p.rank + 1) / 4) * 100}%`,
                          minHeight: 2,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Per-archetype comparison
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-2">Archetype</th>
                  <th className="px-3 py-2">Mean</th>
                  <th className="px-3 py-2">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.by_archetype ?? []).map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-[var(--outline-variant)]"
                  >
                    <td className="px-3 py-2 font-medium">{r.key}</td>
                    <td className="px-3 py-2">{r.mean}</td>
                    <td className="px-3 py-2 text-[var(--on-surface-variant)]">
                      [{r.ci95.lower}, {r.ci95.upper}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Curriculum quality report
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
            <p>
              Mean ALE:{" "}
              <strong>{dashboard?.curriculum_quality.mean_ale ?? "—"}</strong>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              Low-dimension hotspots
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {(
                dashboard?.curriculum_quality.low_dimension_hotspots ?? []
              ).map((h) => (
                <li key={h.id}>
                  <span className="font-mono text-xs">{h.id}</span> — {h.mean}
                  /100
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Recommendations (low ALE)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--on-surface)]">
          {(dashboard?.low_ale_recommendations ?? []).length === 0 ? (
            <li>No low-ALE recommendations in current corpus.</li>
          ) : (
            dashboard!.low_ale_recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Weight matrix (ALE v{dashboard?.ale_version ?? "1.0.0"})
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
