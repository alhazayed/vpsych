"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  ledger_version: string;
  algorithm_version: string;
  n: number;
  mean_vqi: number | null;
  immutable: true;
  by_event: Array<{ event_type: string; n: number }>;
  by_diagnosis: Array<{ key: string; n: number; mean_vqi: number }>;
  by_model: Array<{ key: string; n: number; mean_vqi: number }>;
  by_language: Array<{ key: string; n: number; mean_vqi: number }>;
  by_release: Array<{ key: string; n: number; mean_vqi: number }>;
  recent: Array<{
    id: string;
    created_at: string;
    session_id: string | null;
    diagnosis_slug: string | null;
    vqi: number | null;
    event_type: string;
    content_hash: string;
  }>;
  trends: Array<{ at: string; mean_vqi: number; n: number }>;
  recommendations: string[];
};

type Benchmark = {
  label: string;
  reference: number;
  current: number;
  delta: number;
  meaningful: boolean;
};

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QualityLedgerDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quality-ledger");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        benchmarks?: Benchmark[];
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load ledger");
      setDashboard(json.dashboard ?? null);
      setBenchmarks(json.benchmarks ?? []);
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

  const openLedger = async (id: string) => {
    setSelected(id);
    setDetail(null);
    const res = await fetch(`/api/admin/quality-ledger?id=${id}`);
    const json = await res.json();
    if (res.ok) setDetail(json.ledger ?? json);
  };

  const exportFmt = async (format: string) => {
    const res = await fetch(`/api/admin/quality-ledger?format=${format}`);
    if (format === "csv") {
      downloadBlob("quality-ledger.csv", await res.text(), "text/csv");
      return;
    }
    downloadBlob(
      `quality-ledger.${format}.json`,
      JSON.stringify(await res.json(), null, 2),
      "application/json",
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          Permanent scientific audit trail
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Quality Ledger
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          Immutable source of truth for every assessment quality metric. Records
          are never updated or deleted — corrections append a new version.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border px-2 py-1">
            Ledger {dashboard?.ledger_version ?? "—"}
          </span>
          <span className="rounded-md border px-2 py-1">
            Algorithm {dashboard?.algorithm_version ?? "—"}
          </span>
          <span className="rounded-md border px-2 py-1 bg-emerald-50 text-emerald-900">
            IMMUTABLE
          </span>
          <span className="rounded-md border px-2 py-1">{source || "…"}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void exportFmt("json")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => void exportFmt("csv")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => void exportFmt("anonymous")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          Anonymous research
        </button>
        <button
          type="button"
          onClick={() => void exportFmt("fhir")}
          className="rounded-md border border-[var(--outline)] px-3 py-2 text-sm"
        >
          FHIR bundle
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Ledger entries"
          value={String(dashboard?.n ?? 0)}
          hint="immutable"
        />
        <Stat
          label="Mean VQI"
          value={
            dashboard?.mean_vqi != null ? dashboard.mean_vqi.toFixed(1) : "—"
          }
          hint="/100"
        />
        <Stat
          label="Event types"
          value={String(dashboard?.by_event.length ?? 0)}
          hint="tracked"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--primary)]">
            By diagnosis
          </h2>
          <GroupTable rows={dashboard?.by_diagnosis ?? []} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--primary)]">
            By language
          </h2>
          <GroupTable rows={dashboard?.by_language ?? []} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--primary)]">By AI model</h2>
          <GroupTable rows={dashboard?.by_model ?? []} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[var(--primary)]">
            By platform release
          </h2>
          <GroupTable rows={dashboard?.by_release ?? []} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--primary)]">
          Quality evolution
        </h2>
        {(dashboard?.trends.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            Insufficient history for trends.
          </p>
        ) : (
          <div className="space-y-2">
            {dashboard!.trends.map((t) => (
              <div key={t.at} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-[var(--on-surface-variant)]">
                  {t.at}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, t.mean_vqi)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm tabular-nums">
                  {t.mean_vqi.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--primary)]">Benchmarks</h2>
        <div className="space-y-2">
          {benchmarks.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              No sample benchmarks.
            </p>
          ) : (
            benchmarks.map((b) => (
              <div
                key={b.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm"
              >
                <span>{b.label}</span>
                <span className="tabular-nums">
                  Δ {b.delta >= 0 ? "+" : ""}
                  {b.delta.toFixed(1)}
                  {b.meaningful ? (
                    <span className="ml-2 rounded bg-[var(--surface-container)] px-1.5 py-0.5 text-xs">
                      meaningful
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--primary)]">
          Recent ledger entries
        </h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Diagnosis</th>
                <th className="px-3 py-2">VQI</th>
                <th className="px-3 py-2">Hash</th>
                <th className="px-3 py-2">Audit</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recent ?? []).map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-[var(--outline-variant)] ${selected === r.id ? "bg-[var(--surface-container-low)]" : ""}`}
                >
                  <td className="px-3 py-2 text-xs">{r.created_at.slice(0, 19)}</td>
                  <td className="px-3 py-2">{r.event_type}</td>
                  <td className="px-3 py-2">{r.diagnosis_slug ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {r.vqi?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {r.content_hash.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-[var(--primary)] underline"
                      onClick={() => void openLedger(r.id)}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <section className="space-y-3 rounded-lg border border-[var(--outline-variant)] p-4">
          <h2 className="text-lg font-bold text-[var(--primary)]">
            Ledger replay
          </h2>
          <pre className="max-h-96 overflow-auto rounded-md bg-[var(--surface-container)] p-3 text-[11px] leading-relaxed">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[var(--primary)]">
          Recommendations
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(dashboard?.recommendations ?? ["—"]).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
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
        <h3 className="text-3xl font-bold text-[var(--primary)]">
          {value}
          <span className="ml-1 text-sm font-semibold text-[var(--on-surface-variant)]">
            {hint}
          </span>
        </h3>
      </div>
    </div>
  );
}

function GroupTable({
  rows,
}: {
  rows: Array<{ key: string; n: number; mean_vqi: number }>;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">No data.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--outline-variant)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
          <tr>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">n</th>
            <th className="px-3 py-2">Mean VQI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-t border-[var(--outline-variant)]"
            >
              <td className="px-3 py-2 font-medium">{r.key}</td>
              <td className="px-3 py-2 tabular-nums">{r.n}</td>
              <td className="px-3 py-2 tabular-nums">{r.mean_vqi.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
