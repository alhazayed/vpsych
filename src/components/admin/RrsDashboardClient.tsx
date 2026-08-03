"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  rrs_version: string;
  overall_mean: number | null;
  n: number;
  publication_readiness: {
    mean_rrs: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    recommendations: string[];
  };
  dataset_quality: {
    mean_completeness: number | null;
    mean_integrity: number | null;
    mean_metadata: number | null;
  };
  version_matrix: Array<{
    component: string;
    version: string | null;
    status: string;
  }>;
  reproducibility_matrix: Array<{
    artifact: string;
    seeded: boolean;
    offline_corpus: boolean;
    version_locked: boolean;
    notes: string;
  }>;
  low_rrs_recommendations: string[];
};

type WeightRow = { id: string; weight: number; rationale: string };

export function RrsDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [reports, setReports] = useState<{
    publication?: string;
    dataset?: string;
  } | null>(null);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rrs");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        weight_matrix?: WeightRow[];
        source?: string;
        sample_report?: { publication?: string; dataset?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load RRS");
      setDashboard(json.dashboard ?? null);
      setWeights(json.weight_matrix ?? []);
      setSource(json.source ?? "");
      setReports(json.sample_report ?? null);
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
      const res = await fetch("/api/admin/rrs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persist: false }),
      });
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        sample?: {
          publication_readiness_report?: string;
          dataset_quality_report?: string;
        };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Compute failed");
      setDashboard(json.dashboard ?? null);
      setSource("offline_corpus");
      if (json.sample) {
        setReports({
          publication: json.sample.publication_readiness_report,
          dataset: json.sample.dataset_quality_report,
        });
      }
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
          label="Mean RRS"
          value={
            dashboard?.overall_mean != null ? `${dashboard.overall_mean}` : "—"
          }
          hint="/100"
        />
        <Stat
          label="Datasets"
          value={String(dashboard?.n ?? 0)}
          hint="snapshots"
        />
        <Stat
          label="RRS version"
          value={dashboard?.rrs_version ?? "—"}
          hint="locked"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Publication readiness report
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
            <p>
              Mean RRS:{" "}
              <strong>
                {dashboard?.publication_readiness.mean_rrs ?? "—"}
              </strong>
            </p>
            <p className="text-[var(--on-surface-variant)]">
              {reports?.publication ?? "Recompute to generate report."}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
              Low-dimension hotspots
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {(
                dashboard?.publication_readiness.low_dimension_hotspots ?? []
              ).map((h) => (
                <li key={h.id}>
                  <span className="font-mono text-xs">{h.id}</span> — {h.mean}
                  /100
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Dataset quality report
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-4 text-sm">
            <p>
              Completeness:{" "}
              <strong>
                {dashboard?.dataset_quality.mean_completeness ?? "—"}
              </strong>
            </p>
            <p>
              Integrity:{" "}
              <strong>
                {dashboard?.dataset_quality.mean_integrity ?? "—"}
              </strong>
            </p>
            <p>
              Metadata:{" "}
              <strong>
                {dashboard?.dataset_quality.mean_metadata ?? "—"}
              </strong>
            </p>
            <p className="text-[var(--on-surface-variant)]">
              {reports?.dataset ?? "Recompute to generate report."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Version matrix
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-2">Component</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.version_matrix ?? []).map((r) => (
                  <tr
                    key={r.component}
                    className="border-t border-[var(--outline-variant)]"
                  >
                    <td className="px-3 py-2 font-medium">{r.component}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.version ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
            Reproducibility matrix
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
                <tr>
                  <th className="px-3 py-2">Artifact</th>
                  <th className="px-3 py-2">Seeded</th>
                  <th className="px-3 py-2">Corpus</th>
                  <th className="px-3 py-2">Locked</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.reproducibility_matrix ?? []).map((r) => (
                  <tr
                    key={r.artifact}
                    className="border-t border-[var(--outline-variant)]"
                  >
                    <td className="px-3 py-2 font-medium" title={r.notes}>
                      {r.artifact}
                    </td>
                    <td className="px-3 py-2">{r.seeded ? "yes" : "no"}</td>
                    <td className="px-3 py-2">
                      {r.offline_corpus ? "yes" : "no"}
                    </td>
                    <td className="px-3 py-2">
                      {r.version_locked ? "yes" : "no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Recommendations (low RRS)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--on-surface)]">
          {(dashboard?.low_rrs_recommendations ?? []).length === 0 ? (
            <li>No low-RRS recommendations in current corpus.</li>
          ) : (
            dashboard!.low_rrs_recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
          Weight matrix (RRS v{dashboard?.rrs_version ?? "1.0.0"})
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
