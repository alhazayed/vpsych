"use client";

import { useEffect, useState, useTransition } from "react";

type DashboardPayload = {
  meta?: {
    source?: string;
    validation_version?: string;
    observational?: boolean;
  };
  dashboard?: {
    n_runs: number;
    n_ratings: number;
    quality_metrics_means: Record<string, number>;
    trend: Array<{ at: string; realism_index: number; consistency_index: number }>;
    validation_history: Array<{
      id: string;
      overall_realism: number;
      created_at: string;
    }>;
    expert_ratings_summary: {
      n: number;
      domains: Record<string, { n: number; mean: number }>;
    };
    benchmark_comparisons: Array<{
      metric: string;
      vpsych: number | null;
      baseline: number | null;
      delta: number | null;
      source: string;
    }>;
    reliability_plots: Array<{
      domain: string;
      cohen_kappa: number | null;
      percent_agreement: number | null;
      icc: number | null;
      sufficient_for_inference: boolean;
    }>;
    limitations: string[];
  };
  recent_runs?: Array<{
    id: string;
    realism: number;
    consistency: number;
    created_at: string;
  }>;
};

function Bar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-[var(--on-surface-variant)]">
        <span>{label}</span>
        <span>{v.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-[var(--surface-container)]">
        <div
          className="h-full bg-[var(--primary)] transition-[width] duration-500"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function ResearchValidationPanel() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/validation");
        const json = (await res.json()) as DashboardPayload & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Failed to load validation dashboard");
          return;
        }
        setData(json);
      } catch {
        setError("Network error");
      }
    });
  }

  function compute() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: 50 }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Compute failed");
          return;
        }
        load();
      } catch {
        setError("Network error");
      }
    });
  }

  useEffect(() => {
    load();
  }, []);

  const d = data?.dashboard;
  const means = d?.quality_metrics_means ?? {};
  const trend = d?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((t) => t.realism_index), 100);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)] disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={compute}
          disabled={pending}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)] disabled:opacity-50"
        >
          Run observational batch
        </button>
        <a
          href="/api/admin/validation?format=package"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          Export package
        </a>
        <a
          href="/api/admin/validation?format=csv"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          Export CSV
        </a>
        <a
          href="/api/admin/validation?format=publication"
          className="rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          Publication support
        </a>
      </div>

      {error ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-[var(--on-surface-variant)]">
        Source: {data?.meta?.source ?? "—"} · v
        {data?.meta?.validation_version ?? "—"} · Observational only — patient
        behaviour is never modified. Scores are not clinically validated
        instruments.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Runs", d?.n_runs ?? 0],
          ["Expert ratings", d?.n_ratings ?? 0],
          ["Realism index", means.realism_index?.toFixed?.(1) ?? "—"],
          ["Consistency", means.consistency_index?.toFixed?.(1) ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              {label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-headline)] text-2xl text-[var(--on-surface)]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          Quality metrics
        </h2>
        <div className="max-w-xl">
          {Object.entries(means).map(([k, v]) => (
            <Bar key={k} label={k.replaceAll("_", " ")} value={v} />
          ))}
          {!Object.keys(means).length ? (
            <p className="text-sm text-[var(--on-surface-variant)]">No metrics yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          Realism trend
        </h2>
        <div className="flex h-32 items-end gap-1 overflow-x-auto">
          {trend.map((t, i) => (
            <div
              key={`${t.at}-${i}`}
              title={`${t.at}: ${t.realism_index}`}
              className="min-w-[6px] flex-1 rounded-t bg-[var(--primary)]/80 transition-all duration-300"
              style={{ height: `${(t.realism_index / maxTrend) * 100}%` }}
            />
          ))}
          {!trend.length ? (
            <p className="text-sm text-[var(--on-surface-variant)]">No trend data.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
            Reliability
          </h2>
          <ul className="space-y-2 text-sm text-[var(--on-surface)]">
            {(d?.reliability_plots ?? []).slice(0, 12).map((r, i) => (
              <li key={`${r.domain}-${i}`}>
                <span className="text-[var(--on-surface-variant)]">{r.domain}</span>
                {" · "}κ={r.cohen_kappa ?? "null"} · agree=
                {r.percent_agreement ?? "null"} · ICC={r.icc ?? "null"}
                {!r.sufficient_for_inference ? " · underpowered" : ""}
              </li>
            ))}
            {!d?.reliability_plots?.length ? (
              <li className="text-[var(--on-surface-variant)]">No reliability plots.</li>
            ) : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
            Expert ratings
          </h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(d?.expert_ratings_summary.domains ?? {}).map(
              ([domain, stats]) => (
                <li key={domain}>
                  {domain}: n={stats.n}, mean={stats.mean.toFixed(1)}
                </li>
              ),
            )}
            {!d?.expert_ratings_summary.n ? (
              <li className="text-[var(--on-surface-variant)]">No ratings stored.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          Benchmark comparisons
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-[var(--on-surface-variant)]">
                <th className="py-1 font-medium">Metric</th>
                <th className="py-1 font-medium">VPsych</th>
                <th className="py-1 font-medium">Baseline</th>
                <th className="py-1 font-medium">Δ</th>
                <th className="py-1 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {(d?.benchmark_comparisons ?? []).slice(0, 20).map((b, i) => (
                <tr key={`${b.metric}-${i}`} className="border-t border-[var(--outline-variant)]/40">
                  <td className="py-1">{b.metric}</td>
                  <td className="py-1">{b.vpsych ?? "—"}</td>
                  <td className="py-1">{b.baseline ?? "—"}</td>
                  <td className="py-1">{b.delta ?? "—"}</td>
                  <td className="py-1">{b.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          Validation history
        </h2>
        <ul className="space-y-1 text-sm text-[var(--on-surface)]">
          {(data?.recent_runs ?? d?.validation_history ?? []).slice(0, 15).map((r) => (
            <li key={r.id}>
              {r.id.slice(0, 18)}… · realism=
              {"realism" in r ? r.realism : r.overall_realism} · {r.created_at}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-headline)] text-lg text-[var(--on-surface)]">
          Limitations
        </h2>
        <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--on-surface-variant)]">
          {(d?.limitations ?? []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
