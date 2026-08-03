"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  platform_version: string;
  layers: {
    operational: {
      version: string;
      n: number;
      by_category: Array<{ key: string; n: number }>;
    };
    education: {
      version: string;
      n: number;
      by_type: Array<{ key: string; n: number }>;
    };
    quality: { version: string; n: number; mean_vqi: number | null };
  };
  correlations: number;
  recent_operational: Array<{
    id: string;
    event_type: string;
    category: string;
    outcome: string;
    severity: string;
    created_at: string;
  }>;
  recent_educational: Array<{
    id: string;
    event_type: string;
    session_id: string | null;
    diagnosis_slug: string | null;
    outcome: string | null;
    created_at: string;
  }>;
  recent_quality: Array<{
    id: string;
    session_id: string | null;
    vqi: number | null;
    created_at: string;
  }>;
  recommendations: string[];
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

export function MultiLedgerDashboardClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replay, setReplay] = useState<unknown[] | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ledgers");
      const json = (await res.json()) as {
        dashboard?: Dashboard;
        source?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load ledgers");
      setDashboard(json.dashboard ?? null);
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

  const exportFmt = async (format: string) => {
    const res = await fetch(`/api/admin/ledgers?format=${format}`);
    if (format === "csv") {
      downloadBlob("multi-ledger.csv", await res.text(), "text/csv");
      return;
    }
    downloadBlob(
      `multi-ledger.${format}.json`,
      JSON.stringify(await res.json(), null, 2),
      "application/json",
    );
  };

  const runReplay = async () => {
    if (!sessionFilter.trim()) return;
    const res = await fetch(
      `/api/admin/ledgers?session=${encodeURIComponent(sessionFilter.trim())}`,
    );
    const json = await res.json();
    setReplay(json.timeline ?? []);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          Enterprise multi-ledger platform
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Multi-Ledger Architecture
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          Three complementary immutable ledgers — Operational, Educational, and
          Scientific Quality — linked by correlation IDs for end-to-end
          traceability from infrastructure to education to scientific evidence.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border px-2 py-1">
            Platform {dashboard?.platform_version ?? "—"}
          </span>
          <span className="rounded-md border px-2 py-1 bg-emerald-50 text-emerald-900">
            3 LAYERS · IMMUTABLE
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
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <LayerCard
          title="1 · Operational"
          subtitle="Technical audit trail"
          version={dashboard?.layers.operational.version}
          n={dashboard?.layers.operational.n ?? 0}
          detail={`Categories: ${(dashboard?.layers.operational.by_category ?? [])
            .slice(0, 4)
            .map((c) => c.key)
            .join(", ") || "—"}`}
        />
        <LayerCard
          title="2 · Educational"
          subtitle="Learner interaction history"
          version={dashboard?.layers.education.version}
          n={dashboard?.layers.education.n ?? 0}
          detail={`Types: ${(dashboard?.layers.education.by_type ?? [])
            .slice(0, 4)
            .map((c) => c.key)
            .join(", ") || "—"}`}
        />
        <LayerCard
          title="3 · Scientific Quality"
          subtitle="Immutable quality evidence"
          version={dashboard?.layers.quality.version}
          n={dashboard?.layers.quality.n ?? 0}
          detail={`Mean VQI: ${dashboard?.layers.quality.mean_vqi?.toFixed(1) ?? "—"} · Correlations: ${dashboard?.correlations ?? 0}`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <RecentList
          title="Operational events"
          rows={(dashboard?.recent_operational ?? []).map((e) => ({
            id: e.id,
            primary: e.event_type,
            secondary: `${e.category} · ${e.outcome} · ${e.severity}`,
            at: e.created_at,
          }))}
        />
        <RecentList
          title="Educational events"
          rows={(dashboard?.recent_educational ?? []).map((e) => ({
            id: e.id,
            primary: e.event_type,
            secondary: `${e.diagnosis_slug ?? "—"} · ${e.outcome ?? ""}`,
            at: e.created_at,
          }))}
        />
        <RecentList
          title="Scientific quality"
          rows={(dashboard?.recent_quality ?? []).map((e) => ({
            id: e.id,
            primary: `VQI ${e.vqi?.toFixed(1) ?? "—"}`,
            secondary: e.session_id ?? "—",
            at: e.created_at,
          }))}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--outline-variant)] p-4">
        <h2 className="text-lg font-bold text-[var(--primary)]">
          Cross-ledger replay
        </h2>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Enter a session ID to reconstruct the infrastructure → education →
          quality timeline.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            placeholder="Session UUID"
            className="min-w-[280px] flex-1 rounded-md border border-[var(--outline)] bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void runReplay()}
            className="rounded-md border border-[var(--outline)] px-4 py-2 text-sm font-semibold"
          >
            Replay
          </button>
        </div>
        {replay && (
          <div className="mt-3 space-y-2">
            {(replay as Array<{ at: string; layer: string; type: string; summary: string }>).length ===
            0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                No events for this session in current corpus.
              </p>
            ) : (
              (replay as Array<{ at: string; layer: string; type: string; summary: string }>).map(
                (p, i) => (
                  <div
                    key={`${p.at}-${i}`}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--outline-variant)] px-3 py-2 text-sm"
                  >
                    <span className="w-40 shrink-0 text-xs text-[var(--on-surface-variant)]">
                      {p.at.slice(0, 19)}
                    </span>
                    <span className="rounded bg-[var(--surface-container)] px-1.5 py-0.5 text-xs uppercase">
                      {p.layer}
                    </span>
                    <span className="font-medium">{p.type}</span>
                    <span className="text-[var(--on-surface-variant)]">
                      {p.summary}
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        )}
      </section>

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

function LayerCard({
  title,
  subtitle,
  version,
  n,
  detail,
}: {
  title: string;
  subtitle: string;
  version?: string;
  n: number;
  detail: string;
}) {
  return (
    <div className="clinical-card space-y-2 p-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
        {subtitle}
      </p>
      <h3 className="text-xl font-bold text-[var(--primary)]">{title}</h3>
      <p className="text-3xl font-bold tabular-nums">{n}</p>
      <p className="text-xs text-[var(--on-surface-variant)]">
        v{version ?? "—"} · {detail}
      </p>
    </div>
  );
}

function RecentList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string; at: string }>;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-[var(--primary)]">{title}</h2>
      <div className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">No events.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="border-b border-[var(--outline-variant)]/50 pb-2 last:border-0">
              <p className="text-sm font-medium">{r.primary}</p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {r.secondary}
              </p>
              <p className="text-[10px] text-[var(--outline)]">
                {r.at.slice(0, 19)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
